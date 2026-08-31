# MinIO 버킷 정책

## `avatars-public-read.json` — 아바타 이미지 공개 읽기

`POST /api/users/me/avatar` (spec `9-user-profile.md §6.1`) 의 **배포 선행 조건**이다.
아바타는 공개 URL 로 서빙되므로 이 정책이 없으면 업로드는 성공하고 **이미지만 403** 이 된다.

`docker-compose.yml` · `docker-compose.e2e.yml` 의 `createbuckets` 가 이 파일을 마운트해
`mc anonymous set-json` 으로 적용한다.

## 왜 `mc anonymous set download` 를 쓰지 않는가 — 실측으로 기각했다

처음에는 `mc anonymous set download local/workflow-storage/avatars` 를 썼다. 이름만 보면
"다운로드만 허용" 같지만 **접두에 걸면 `s3:ListBucket` 을 함께 연다.** 실측:

```
$ mc anonymous set download local/workflow-storage/avatars
$ mc anonymous get-json local/workflow-storage
{"Statement":[
  {"Action":["s3:GetBucketLocation"], ...},
  {"Action":["s3:ListBucket"],"Condition":{"StringEquals":{"s3:prefix":["avatars"]}}, ...},
  {"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::workflow-storage/avatars*"], ...}
]}

$ curl -s 'http://minio:9000/workflow-storage?list-type=2&prefix=avatars'
<ListBucketResult …><Contents><Key>avatars/user-123/9f8e-uuid.png</Key>…
```

**목록이 열리면 이 기능의 접근 통제가 통째로 무너진다.** 공개 버킷에서 아바타를 지키는 것은
키에 든 UUID 의 추측 불가능성 하나뿐인데(`avatars/{userId}/{uuid}.{ext}`), 열거가 되면
추측할 필요가 없어진다.

명시 정책으로 바꾼 뒤 실측:

```
$ curl -s 'http://minio:9000/workflow-storage?list-type=2&prefix=avatars'
<Error><Code>AccessDenied</Code>…

$ curl -o /dev/null -w '%{http_code}' 'http://minio:9000/workflow-storage/avatars/user-123/9f8e-uuid.png'
200
```

## 운영 버킷에도 같은 조건이 필요하다

S3/호환 스토리지에 이 정책을 그대로 적용한다 — `Resource` 의 버킷명만 환경에 맞춘다.
**`ListBucket` 을 포함하지 않는지 반드시 확인할 것.** "public read" 프리셋을 제공하는
콘솔·CLI 는 대개 목록 조회를 함께 열어 준다.
