# Simple S3 Deploy

Simplest way to deploy static files to S3 bucket in aws.

## Installation

Install with npm

```bash
  npm install simple-s3-deploy
```

## Usage

```javascript
const s3Deploy = require("simple-s3-deploy")

// Specify required data
const deployOptions = 
{
  ID : "AKIAULL....",
  SECRET : "HWr+7+NEYnPG.....",
  BUCKET_NAME : "my-bucket",
  DEPLOY_FOLDER_PATH : "./dist/",
  CACHE : 
  {
    ID : "XXXXXXXXXXXXXX",
    QUANTITY : 1,
    PATH : ["/*"],
  }
}

// Deploy
s3Deploy.deploy(deployOptions);

```

## Parameters

#### deplay(deployOptions)

Takes `deployOptions` and deploys files to S3 bucket.

#### Deploy Options Keys :

| Keys                   | Sample                                                      | Description                                                                                                                                                            |
| :--------------------- | :---------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ID`                 | `string`                                                  | **Required**. Your AWS access key Id.                                                                                                                            |
| `SECRET`             | `string`                                                  | **Required**. Your AWS access key Secret.                                                                                                                        |
| `CROSS_ACCOUNT_ROLE` | `arn:aws:iam::99999999:role/dev`                          | **Optional**. Your AWS role arn.                                                                                                                                 |
| `BUILD_CMD`          | `ng build`                                                | **Optional**. CMD build command to build project.                                                                                                                |
| `BUCKET_NAME`        | `my-bucket`                                               | **Required**. Your AWS S3 Bucket name where you eat to deploy code.                                                                                              |
| `DEPLOY_FOLDER_PATH` | `./dist/app`                                              | **Required**. Local folder path where deployable files are build.                                                                                                |
| `IGNORE_FILES`       | `[ "node_module", ".DS_Store" ]`                          | **Optional**. Files that you dont want to upload.                                                                                                                |
| `CACHE`              | `{ ID : "E17G7YNEXAMPLE", QUANTITY : 1, PATHS : ["/*"] }` | **Optional**. Specify if you have distribution and you want to invalidate cache.                                                                                 |
| `ACL`                | `string`                                                  | **Optional**. Valid Values: `private \| public-read \| public-read-write \| authenticated-read \| aws-exec-read \| bucket-owner-read \| bucket-owner-full-control` |

#### CACHE Options Keys :

| Keys         | Type       | Sample             | Description                                                                                |
| :----------- | :--------- | :----------------- | :----------------------------------------------------------------------------------------- |
| `ID`       | `string` | `E17G7YNEXAMPLE` | **Required**. Distribution Id where you want to create invalidation to clear cache.  |
| `QUANTITY` | `number` | `1`              | **Required**. Number of file to delete.                                              |
| `PATHS`    | `Array`  | ["/*"]             | **Required**. List of paths that you want to clear. (["/*"] to invalidate all files) |

## License

[MIT](https://choosealicense.com/licenses/mit/)
