# 유지보수성(Maintainability) 리뷰

## 검토 범위

- `codebase/backend/migrations/V111__trigger_workflow_id_index.conf` (신규)
- `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` (신규)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (`releaseExternalForParent` 의 `select` 좁히기)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` (대응 단언 추가)
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (인덱스 schema 단언 추가)
- `plan/in-progress/spec-draft-trigger-workflow-index.md`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` (문서)
- `review/consistency/2026/09/18/{12_18_52,12_26_41}/**` — 자동 생성 감사 산출물(코드 아님, 유지보수성 판단 대상에서 제외)

실제 코드 변경 표면은 작다: 인덱스 추가 마이그레이션 1개, `find()` 호출 하나에 `select` 절 추가, 그에 대응하는 테스트 단언 보강. `trigger-resource-releaser.service.ts` 전체와 `chat-channel-binder.service.ts::teardownChatChannel`/`teardownRegisteredChannel` 을 직접 열어 `select: { id, type, config }` 가 실제 소비 필드(`trigger.id`, `trigger.type`, `trigger.config.chatChannel`)와 정확히 일치함을 확인했다.

## 발견사항

- **[INFO]** 마이그레이션 파일의 주석/코드 비율이 매우 높음 (약 30줄 주석 : 4줄 SQL)
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:1`~`30` (주석), 실제 DDL은 `:31`~`35`
  - 상세: DROP-먼저 이유, 실측 표, 트랜잭션 비활성화 근거가 모두 파일 헤더에 들어 있어 실제 변경(`DROP INDEX … ; CREATE INDEX …;`)을 찾기 전에 긴 서술을 읽어야 한다. 다만 이 저장소는 `migrations/README.md` §4·§5 로 이 서술형 주석 관례를 이미 정식화했고 V106·V110 등 선례가 동일 패턴이므로, 이번 파일만의 일탈은 아니다.
  - 제안: 조치 불요(기존 컨벤션 준수). 다만 이 컨벤션 자체가 앞으로도 마이그레이션 파일을 "미니 spec 문서"로 키우는 방향이라는 점은 팀이 인지하고 있어야 한다.

- **[INFO]** 선택 컬럼(`select: { id, type, config }`)의 근거 서술이 프로덕션 코드 JSDoc과 테스트 주석 두 곳에 중복
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `releaseExternalForParent` 메서드 JSDoc / `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` — 해당 `it` 블록 내 주석(`선택 컬럼을 **정확히** 고정한다 …`)
  - 상세: 두 주석 모두 "`config` 가 빠지면 teardown 이 조용히 no-op 이 된다" 는 동일한 근거를 각자의 말로 서술한다. 실제 컬럼 목록이 셋 중 하나라도 바뀌면(JSDoc은 그대로 두고 테스트만 `select` 객체를 고치는 식으로) 두 서술이 어긋날 여지가 있다.
  - 제안: 현재는 두 주석이 서로를 참조하지 않아도 내용이 일치하지만, 실질적 위험은 낮다(변경 시 `expect(...).toHaveBeenCalledWith(...)` 가 즉시 깨져 drift 를 감지한다). 조치는 선택 사항 — 테스트 주석에서 JSDoc 을 `{@link releaseExternalForParent}` 로 참조해 서술을 한쪽으로 모으는 정도면 충분.

## 평가

이번 변경은 스코프가 매우 좁고(마이그레이션 1개 + `find()` 호출 하나의 `select` 절), 기존 코드베이스의 문서화 관례(마이그레이션 헤더 주석, JSDoc 에 "왜"를 남기는 패턴, e2e 의 schema 단언 선례인 V110)를 그대로 따른다. 함수 길이·중첩 깊이·매직 넘버·이름 규칙 어디에도 새로운 위반이 없고, `select` 로 좁힌 컬럼이 실제 소비 지점과 정확히 일치함을 직접 소스를 열어 확인했다. 위에서 지적한 두 항목은 모두 INFO 수준으로, 기존 컨벤션의 자연스러운 결과이거나 실질적 drift 위험이 낮은 중복 서술이라 조치 없이 진행해도 무방하다.

## 위험도

NONE
