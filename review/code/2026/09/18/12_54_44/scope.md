# 변경 범위(Scope) 리뷰 — trigger (workflow_id) 인덱스

## 검토 방법
`git diff origin/main...HEAD` (merge-base `44bcad9aa`) 로 실제 diff 26개 파일 전량을 대조했고, 프롬프트에서
전체 컨텍스트가 잘린 4개 파일(`migrations/README.md`, `trigger-resource-releaser.service{.spec}.ts`,
`trigger-deletion-releases-resources.e2e-spec.ts`)은 `Read`/`git diff` 로 직접 확인했다.

## 발견사항

- **[INFO]** `spec/1-data-model.md` §3 표에 이번 작업 스코프 밖의 `notification_health` 부분 인덱스(V061) 행이 함께 추가됨
  - 위치: `spec/1-data-model.md` — §3 인덱스 전략 표, `Trigger (workflow_id)` 행 바로 다음 줄 (`| Trigger | (notification_health) WHERE notification_health = 'degraded' | …`)
  - 상세: 이 PR 의 목표는 `Trigger (workflow_id)` 인덱스(V111) 추가 하나다. 그런데 §3 표 편집 시 원래 표에 없던 기존 V061 인덱스 행("사전 존재 갭", 이번 변경으로 새로 생긴 것 아님)도 같이 끼워 넣었다. `plan/in-progress/spec-draft-trigger-workflow-index.md` 의 `--spec` 처분(INFO 1)에 "S1 과 같은 자리라 행을 함께 넣었다"고 명시적으로 disclose 되어 있고, consistency-check 5개 checker 전원 CRITICAL/WARNING 0 으로 통과했으므로 은폐된 변경은 아니다. 다만 "요청된 변경(V111 행 추가) 외 추가 수정"이라는 점에서 스코프 관점의 경계 사례에 해당한다.
  - 제안: 이미 plan 에 사유가 기록되어 있으므로 현 상태로 수용 가능. 다음에 유사 상황이 생기면 사전 존재 갭은 별도 커밋/트래커 항목으로 분리하는 편이 diff 를 "이번 작업" 과 "발견된 부수 갭"으로 더 깔끔히 가른다.

- **[INFO]** `codebase/backend/migrations/README.md` §5 컨벤션 문서화가 코드 변경(V111)과 같은 논리적 결정을 사후 규약화
  - 위치: `codebase/backend/migrations/README.md` — §5 "신규 추가에도 0) 을 둡니다" 절 (커밋 `ff7d79967`)
  - 상세: README 편집은 "V111 이 왜 DROP-먼저 형태를 쓰는지"를 일반 컨벤션으로 승격한 것으로, V111 구현과 직접 연결된 근거 문서화다. 무관한 수정은 아니지만, 이 편집이 `codebase/**` 로 분류되어 `/ai-review` 게이트가 2라운드를 요구했다는 사실이 plan 체크리스트에 기록되어 있다 — 범위 자체는 타당하나 "문서 편집 하나가 코드 게이트를 다시 태운다"는 점은 리뷰 비용 관점에서 참고할 만하다.

## 스코프 내 확인된 항목 (문제 없음)
- `V111__trigger_workflow_id_index.sql` + `.conf`: 신규 마이그레이션 파일, 인덱스 하나만 생성. 계획대로.
- `trigger-resource-releaser.service.ts`: `releaseExternalForParent` 의 `find()` 에 `select: { id, type, config }` 추가 — 트래커의 "셋째 불릿"(과다 컬럼 적재)만 정확히 닫는다. 다른 메서드·로직 변경 없음.
- 대응 unit test(`*.spec.ts`)·e2e test(`trigger-deletion-releases-resources.e2e-spec.ts`) 추가분은 각각 `select` 축소와 V111 인덱스 유효성만 검증 — 기능 확장이나 무관한 테스트 추가 없음.
- `spec/1-data-model.md`(Rationale 신규 절) · `spec/data-flow/10-triggers.md`(§2.1 문구 한 줄) — 계획된 S1~S3 과 정확히 일치.
- `review/consistency/2026/09/18/{12_18_52,12_26_41}/**` · `plan/in-progress/spec-draft-trigger-workflow-index.md`: SDD 워크플로 상 의무인 `--spec`/`--impl-prep` consistency-check 산출물과 작업 추적 plan — 코드 범위 밖의 하네스 규약에 따른 정상 산출물이며 스코프 침범 아님.
- 포맷팅/주석/임포트/설정 파일 변경: 무관한 diff 없음. drive-by 리팩토링·불필요한 import 정리·의미 없는 공백 변경 없음.

## 요약
diff 전체(3커밋, 26파일)가 plan 에 명시된 목표 — V111 인덱스 추가, README §5 규약화, `releaseExternalForParent` select 축소, 대응 spec/test 갱신 — 에 정밀하게 대응한다. 유일한 경계 사례는 `spec/1-data-model.md` 표에 이번 작업과 무관한 기존 갭(`notification_health` 행)을 같은 편집에서 함께 채워 넣은 것인데, 이는 consistency-check 로 사전 검토되고 plan Rationale 에 사유가 명시적으로 기록된 disclosed 추가라 은폐된 스코프 확장은 아니다. 드라이브바이 리팩토링, 불필요한 포맷팅, 무관한 임포트/주석/설정 변경은 발견되지 않았다.

## 위험도
LOW
