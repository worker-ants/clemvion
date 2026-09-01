# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 검토 범위·방법

target 은 `spec/**` 6개 문서에 적용될 변경안을 담은 spec draft (`plan/in-progress/spec-draft-avatar-storage-key.md`, `--spec` 검토 모드)다. draft 본문이 인용하는 현재 spec 라인 번호(§A `0-overview.md:265/276/278`, §B `:369/371-373`, §C `4-file-storage.md:19/128/129-131`, §E 앵커 grep, §G `2-api-convention.md:280/284`, §H `data-flow/0-overview.md:273`)를 전부 실제 저장소 파일과 대조했고, 신규 도입 에러 코드(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)는 `spec/conventions/error-codes.md` 및 실제 코드(`users.service.ts`, `users.controller.ts`, e2e spec)와 대조했다. bundle 에 포함된 `spec/conventions/swagger.md`·`audit-actions.md`·`error-codes.md` 전문과, 컨텍스트 예산으로 절단된 나머지 conventions 파일은 실제 저장소에서 필요한 범위만 직접 열어 확인했다.

## 발견사항

- **[INFO]** §D-2(413 조건)에 error `code` 미기재 — 인접 관행과 형식이 갈린다
  - target 위치: target §D-2 (`spec/2-navigation/9-user-profile.md:334` 갱신안) — "…크기 초과 413" (code 없음)
  - 위반 규약: `spec/conventions/error-codes.md` §1 "클라이언트는 코드의 의미로 분기" 원칙 + `spec/5-system/2-api-convention.md` §6 "413=`PAYLOAD_TOO_LARGE`(기본값)" 매핑. 형식 관행은 target 이 편집하려는 바로 그 표의 인접 행(`9-user-profile.md:337`~`338`)이 스스로 세운다 — 그 행들은 "토큰 무효·만료 400 `VALIDATION_ERROR`", "pending 없으면 400 `VALIDATION_ERROR`"처럼 **조건마다 code 를 명시**한다.
  - 상세: 같은 D-2 항목 안에서 400 두 케이스(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)는 code 를 명시하면서 413 케이스만 code 를 생략해 표 안에서 표기가 비대칭이다. 실제 코드 확인 결과 `FileInterceptor` `limits.fileSize` 초과는 e2e 테스트(`users-avatar-upload.e2e-spec.ts:118-133`)가 `status===413`만 단언하고 `error.code`는 단언하지 않아 런타임 값이 **직접 확정되지는 않았다** — 다만 `GlobalExceptionFilter.mapHttpErrorLike`/`getCodeFromStatus`(`http-exception.filter.ts:140-153`)가 4xx http-error-like 예외를 상태 기반으로 매핑하는 유일한 413 경로이므로, 이 앱에서 413이 나는 경로는 사실상 `PAYLOAD_TOO_LARGE` 하나뿐이다(§1.3 표에도 이미 등재됨, 신규 코드 아님).
  - 제안: 가능하면 `PAYLOAD_TOO_LARGE`를 D-2에 명시해 인접 셀과 형식을 맞춘다. 런타임 값을 이번 draft 범위에서 실측하지 않았다면, "코드 미확인"이라고 명시하거나 §F 처럼 §1.3 기존 카탈로그 참조로 대체해 침묵보다 의도를 드러낸다 — CRITICAL/WARNING 은 아니다(코드 자체를 새로 정의하는 문제가 아니라 이미 카탈로그에 있는 기존 코드를 언급만 안 한 것).

- **[INFO]** 변경안 절 레터링이 본문 순서와 어긋난다 (A,B,C,D,**G,H**,**E,F**)
  - target 위치: target `## 변경안` 전체 구조 — 헤더 순서 `### A`→`### B`→`### C`→`### D`→`### G`→`### H`→`### E`→`### F`
  - 위반 규약: 명시적 conventions 문서가 레터 순서를 강제하지는 않으므로 CRITICAL/WARNING 대상 "규약 위반"은 아니다. 다만 §D-4가 "체크리스트 전항목 체크(§A~§H 가 각각 어느 항목을 해소했는지 명시)"라고 위임 트래커 쪽 정합을 요구하는데, 정작 이 draft 자신의 §A~§H 순서가 알파벳 순이 아니어서 그 대응표를 만드는 사람이 헷갈리기 쉽다.
  - 상세: §E 자신의 서술("초판의 이 방법이 좁았고... §G·§H 가 그 그물을 빠져나갔다")로 미루어 G·H는 E 이후에 발견돼 추가된 것으로 보이는데, 최종 배치는 D 바로 뒤 G·H, 그 다음 E·F 순이라 발견 시점 서사와 파일상 위치가 안 맞는다.
  - 제안: `spec/` 반영 시점에는 문제되지 않지만(변경안 레터는 draft 전용 메타데이터이지 spec 본문에 남는 게 아님), 위임 트래커(`spec-update-avatar-upload-implemented.md`)의 체크리스트 항목과 대조표를 만들 때는 실제 파일 순서(A,B,C,D,G,H,E,F)를 그대로 쓰거나, 커밋 전에 E,F,G,H를 알파벳 순으로 재배치해 혼동 여지를 없앤다.

## 요약

target 은 명명 규약(`spec-draft-<name>.md` kebab-case, `plan/in-progress/spec-draft-avatar-storage-key.md`), 문서 구조 규약(Overview → 변경안 본문 → Rationale 3섹션, `project-planner` SKILL.md §Spec 문서 구조와 일치), 출력 포맷 규약(각 대상 표의 기존 컬럼 헤더·앵커 슬러그 생성 규칙을 그대로 보존) 을 광범위하게 정확히 지킨다. 특히 신규 도입 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE`는 `error-codes.md` §1의 "의미 기반 명명 + prefix-less 공용 코드" 예외 카테고리에 정확히 부합하고(§1.3 기존 표에 이미 같은 성격의 prefix-less 코드가 다수 선례로 존재), draft가 인용하는 모든 라인 번호·앵커 슬러그·env 변수명(`S3_PUBLIC_BASE_URL`)·파일 경로(`scripts/minio/*`)를 실제 저장소와 대조한 결과 전부 정확했다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았고, 발견된 두 건은 모두 INFO 수준의 표기 완결성·가독성 제안이다.

## 위험도
LOW
