# 보안(Security) 리뷰

## 리뷰 범위

이번 diff 는 코드가 아니라 **인프라 이미지 교체**다 — `docker-compose.yml`(dev) · `docker-compose.e2e.yml` ·
`k8s/overlays/local/infra-minio.yaml` 세 곳의 MinIO 서버/`mc` 클라이언트 이미지를
`quay.io/minio/{minio,mc}` 에서 `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb…`(단일
이미지, 태그+다이제스트 고정)로 바꾸고, CHANGELOG·plan 문서(`plan/complete/e2e-minio-registry.md`,
`plan/in-progress/minio-silo-image.md`, 두 트래커 문서)로 그 경과를 기록했다. `review/consistency/**`
산출물(파일 9~16)은 이미 완료된 `--impl-prep` 실행 결과이며 신규 코드가 아니다.

## 발견사항

- **[INFO]** 공식 벤더 이미지에서 커뮤니티 포크로 신뢰 축이 이동
  - 위치: `docker-compose.yml:43`, `docker-compose.e2e.yml:69,82`, `k8s/overlays/local/infra-minio.yaml:41,103`
  - 상세: 세 곳 모두 `minio/minio`·`minio/mc`(MinIO Inc. 공식 배포)에서 `pgsty/silo`(Pigsty 가
    유지하는 서드파티 커뮤니티 포크, plan 문서 자신도 "커뮤니티 포크"라고 명시)로 바뀌었다. S3
    호환 스토리지 서버 자체를 공급하는 이미지이므로 공급망 신뢰 주체가 "MinIO Inc." 에서
    "커뮤니티 유지보수자 1인/조직" 으로 격하된다. 리포에는 이미지 서명 검증(cosign/notary 등)
    체계가 없어 다이제스트 고정(`@sha256:…`) 이 유일한 무결성 앵커다 — 이는 "최초 획득 시점의
    바이트를 고정" 할 뿐 "그 바이트가 안전하다" 는 것은 보증하지 않는다.
  - 완화 요소(실측으로 확인): (1) 세 위치 모두 **local/dev/e2e 전용**이다 — `k8s/overlays/staging`·
    `k8s/overlays/prod` 에는 minio/silo 참조가 전혀 없다(grep 0건, 실제 운영은 별도 관리형 스토리지로
    추정). (2) 태그뿐 아니라 다이제스트까지 고정해 pull 시점마다 동일 바이트를 보장한다. (3) plan
    문서(`plan/in-progress/minio-silo-image.md` §C)가 서버 동작·아바타 공개 정책·볼륨 호환성을
    실측했고, 이미 `--impl-prep`(`review/consistency/2026/09/24/23_12_45`, BLOCK:NO)이 같은 지적을
    INFO로 검토·기록했다(§F #1, #8 — "다시 제3자 공개 레지스트리 하나에 기댄다" 를 이미 인지하고
    "세 번째 폐쇄 시 GHCR 미러링 재검토" 로 트래커에 등재).
  - 제안: 신규 조치 불요(이미 처리·추적됨). 다만 이 이미지가 향후 local/e2e 범위를 벗어나
    staging/prod 오버레이로 확장될 가능성이 생기면, 그 시점에는 이미지 서명 검증 또는 벤더 공식
    이미지 사용을 재검토할 것을 권장한다.

- **[INFO]** 대상 파일 내 하드코딩 자격증명 — 이번 diff 로 신규 도입된 것 아님
  - 위치: `docker-compose.e2e.yml` (`MINIO_ROOT_USER: clemvion` / `MINIO_ROOT_PASSWORD:
    clemvion-e2e` 등, unified diff 문맥 줄 — 이번 diff 의 변경 대상 아님)
  - 상세: 두 compose 파일에 평문 테스트용 자격증명이 존재하지만, 이번 diff 의 `+`/`-` 라인은
    `image:` 필드와 주석뿐이고 이 자격증명 줄은 그대로 유지된 컨텍스트다. e2e/dev 전용이며 이미
    "운영 절대 사용 금지" 주석이 붙어 있어 이번 리뷰의 지적 대상이 아니다(참고용으로만 기재).

## 점검했으나 이상 없음

- **인젝션**: `entrypoint`/`command` 의 `mc alias set … \"$$MC_USER\" \"$$MC_PASS\"` 셸 이스케이프
  패턴은 이번 diff 에서 손대지 않았고 그대로 유지된다. 새 셸 조립 코드는 없다.
- **경로 탐색**: 신규 볼륨 마운트·경로 처리 없음.
- **인증/인가**: 이번 diff 는 인가 로직을 건드리지 않는다. K8s manifest 의 `MINIO_ROOT_USER/PASSWORD`
  는 여전히 `secretKeyRef` 경유로, 평문 노출 없음(diff 밖).
- **암호화**: 헬스체크·엔드포인트가 여전히 http 이지만 사설 docker/k8s 내부망 한정이며 이번 diff 로
  바뀐 것이 아니다.
- **에러 처리**: 신규 에러 메시지·로그 출력 코드 없음.
- **하드코딩된 시크릿(신규)**: 다이제스트 문자열은 시크릿이 아니며, 새로 도입된 API 키/토큰/인증서
  없음.

## 뮤테이션 검증

가설 검증을 위한 파일 수정을 수행하지 않았다(`git status --short` 로 저장소 상태 변경 없음 확인).
전부 `Read`/`grep` 정적 확인으로 결론에 도달했다.

## 요약

본 diff 는 코드 로직이 아닌 컨테이너 이미지 소스 교체이며, 인젝션·인증/인가·암호화·에러 처리
관점에서 신규 취약점을 도입하지 않는다. 유일한 보안 관점 관찰은 MinIO 공식 이미지에서 커뮤니티
포크(`pgsty/silo`)로 공급망 신뢰 주체가 바뀐 것인데, 적용 범위가 local/dev/e2e 로 한정되고(운영
오버레이 미참조, grep 실증) 다이제스트 고정이 되어 있으며, 이 트레이드오프 자체를 plan 문서와 이미
수행된 `--impl-prep` 리뷰가 인지·기록·추적하고 있어 추가 조치가 필요한 새로운 결함은 아니다.

## 위험도

LOW
