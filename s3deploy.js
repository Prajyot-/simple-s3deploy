const AWS = require('aws-sdk');
const fs = require('fs');
const { execSync } = require('child_process');
const mime = require('mime-types')
let ID = "";
let SECRET = "";

let BUCKET_NAME = "";
let DEPLOY_FOLDER_PATH = "";
let BUILD_CMD = "";
let CROSS_ACCOUNT_ROLE = "";

let IGNORE_FILES = [];
let s3;
let sts;
let cloudfront;

let uploadFilesList = [];

const mandatoryOptions = ["ID", "SECRET", "BUCKET_NAME", "DEPLOY_FOLDER_PATH"];

async function init(options)
{
    if(s3 && cloudfront)
    {
        return;
    }

    if(!checkMandatoryOptions(options))
    {
        throw new Error(`Mandatory fields missing. Please check if following keys are present -> ${mandatoryOptions}`);
    }

    ID = options.ID;
    SECRET = options.SECRET;
    BUCKET_NAME = options.BUCKET_NAME;
    DEPLOY_FOLDER_PATH = options.DEPLOY_FOLDER_PATH;
    BUILD_CMD = options.BUILD_CMD;
    IGNORE_FILES = options.IGNORE_FILES;
    CROSS_ACCOUNT_ROLE = options.CROSS_ACCOUNT_ROLE;

    if(CROSS_ACCOUNT_ROLE && CROSS_ACCOUNT_ROLE != "")
    {
        sts = new AWS.STS({
            accessKeyId: ID,
            secretAccessKey: SECRET
        });
    
        const accessparams = await getCrossAccountCredentials();
        s3 = new AWS.S3(accessparams);
        if(options.CACHE) cloudfront = new AWS.CloudFront(accessparams);
    }
    else
    {
        const cred = 
        {
            accessKeyId: ID,
            secretAccessKey: SECRET
        };

        s3 = new AWS.S3(cred);
        if(options.CACHE) cloudfront = new AWS.CloudFront(cred);
    }    
}

function checkMandatoryOptions(options)
{
    for(let i in mandatoryOptions)
    {
        const val = options[mandatoryOptions[i]]
        if(!val || val == "" || val == null)
        {
            return false;
        }
    }

    return true;
}

const getCrossAccountCredentials = async () => 
{
    return new Promise((resolve, reject) => {
      const timestamp = (new Date()).getTime();
      const params = {
        RoleArn: CROSS_ACCOUNT_ROLE,
        RoleSessionName: `deploy-session-${timestamp}`
      };
      sts.assumeRole(params, (err, data) => {
        if (err) reject(err);
        else {
          resolve({
            accessKeyId: data.Credentials.AccessKeyId,
            secretAccessKey: data.Credentials.SecretAccessKey,
            sessionToken: data.Credentials.SessionToken,
          });
        }
      });
    });
  }

function buildProject()
{
    if(BUILD_CMD && BUILD_CMD != "")
    {
        console.log("Build started. CMD : " + BUILD_CMD);
        execSync(BUILD_CMD);
        console.log('Build Done');
    }
    else
    {
        console.log('Skipping build. No command specified.');
    }
    
}

function createBucket()
{
    const params = {
        Bucket: BUCKET_NAME,
        CreateBucketConfiguration: {
            // Set your region here
            LocationConstraint: "ap-south-1"
        }
    };
    
    s3.createBucket(params, function(err, data) 
    {
        if (err) console.log(err, err.stack);
        else console.log('Bucket Created Successfully', data.Location);
    });
}

async function getAllFiles()
{
    var params = {
    Bucket: BUCKET_NAME
    };

    return await s3.listObjectsV2(params).promise();
}

async function uploadFile(fileName)
{
    // Read content from the file
    const fileContent = fs.readFileSync(fileName);
    // Setting up S3 upload parameters
    const params = 
    {
        Bucket: BUCKET_NAME,
        Key: fileName.replace(DEPLOY_FOLDER_PATH, ""),
        Body: fileContent,
        ContentType: mime.lookup(fileName), 
        ACL: 'public-read'
    };

    // Uploading files to the bucket
    return s3.upload(params).promise();
};

async function deploy(cred)
{
    try
    {
        await init(cred)
        buildProject();
        prepareDeployParams();
        
        try
        {
            console.log("File deletion started.");
            const deployedFiles = await getAllFiles();
            await deleteFiles(deployedFiles);
            console.log("All files deleted.");
        }
        catch(e) 
        {
            console.error("Issue with code deletion.");
        }
        
        try
        {
            console.log("File upload started");
            await uploadDeployFiles();
            console.log("File upload done successfully");
        }
        catch(e)
        {
            console.error("Issue with file upload. ", e.message);
        }

        try
        {
            await clearCache(cred);
        }
        catch(e)
        {
            console.error("Issue with clearing cache. ", e.message);
        }
    }
    catch(e)
    {
        console.error(e);
    }
}

async function uploadDeployFiles()
{
    for(const name of uploadFilesList)
    {
        console.log(`Uploading file : ${name}`);
        await uploadFile(name);
    }
}

async function deleteFiles(filesList)
{
    if(filesList.length == 0)
    {
        return;
    }

    const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: { Objects: [] }
    };

    filesList.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });

    await s3.deleteObjects(deleteParams).promise();
}

function prepareDeployParams()
{
    console.log("Preparing deploy files list");
    uploadFilesList = [];
    readFiles(DEPLOY_FOLDER_PATH, (name) => 
    {
        uploadFilesList.push(name);
    });

    console.log("Deploy files list created");
}

function readFiles(dirname, onFileContent, onError) 
{
    const filenames = fs.readdirSync(dirname);
    filenames.forEach(function(filename) 
    {
        if(IGNORE_FILES.includes(filename))
        {
            return;
        }
        
        if(fs.lstatSync(`${dirname}/${filename}`).isDirectory())
        {
            readFiles(`${dirname}${filename}/`, onFileContent, onError)
        }
        else
        {
            onFileContent(`${dirname}${filename}`);
        }
    });
}

async function clearCache(options)
{
    if(options.CACHE)
    {
        await init(options);
        await clearCloudfrontCache(options.CACHE.ID, options.CACHE.PATHS, options.CACHE.QUANTITY)
    }
    else
    {
        console.log("Skipping clearing cache. Cache details not provided.");
    }
}

async function clearCloudfrontCache(distribution_id, paths, quantity)
{
    return new Promise((resolve, reject) => 
    {
        console.log(`Clearing Cloudfront invalidation for ${distribution_id}`);
        var currentTimeStamp = new Date().getTime();
        var params = 
        {
            DistributionId: distribution_id,
            InvalidationBatch: 
            {
              CallerReference: currentTimeStamp.toString(),
              Paths: 
              {
                Quantity : quantity,
                Items: paths
              }
          }
        };
    
        cloudfront.createInvalidation(params, function(err, data) 
        {
          if (err) 
          {
            console.log("Error came while cloudfront cache removal",err);
            reject(err);
          }
          else 
          {
            console.log("Cloudfront created invalidation.");
            console.log(`Invalidation id : ${data.Invalidation.Id}`);
            console.log(`Invalidation status : ${data.Invalidation.Status}`);
            resolve(data.Invalidation);
          }
        });
    });
    
}

/*const data = 
{
    Location: 'xxxx',
    Invalidation: 
    {
      Id: 'xxxx',
      Status: 'InProgress',
      CreateTime: 2021-11-18T04:04:49.184Z,
      InvalidationBatch: { Paths: [Object], CallerReference: '1637208287439' }
    }
  }
  
  
     
     * The identifier for the invalidation request. For example: IDFDVBD632BHDS5.
     
       Id: string;
       
        * The status of the invalidation request. When the invalidation batch is finished, the status is Completed.
       
       Status: string;
       
        * The date and time the invalidation request was first made. 
       
       CreateTime: timestamp;
       
        * The current invalidation information for the batch request. 
       
       InvalidationBatch: InvalidationBatch;
  
  */

function getInvalidationStatus(distributionId, invalidationId)
{
    const params = 
    {
        'DistributionId' : distributionId,
        'Id' : invalidationId
    }
    
    cloudfront.getInvalidation(params, (err, data) => 
    {
        if(err)
        {
            console.error(`Distribution : ${distributionId} > Invalidation : ${invalidationId}. Error while getting status.`,err);
        }
        else
        {
            console.log(`Distribution : ${distributionId} > Invalidation : ${invalidationId} - ${data.Invalidation.Status}`);
        }
        
    });
}

module.exports = 
{
    deploy : deploy,
    clearCache : clearCache
}