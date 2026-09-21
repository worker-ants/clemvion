# 요구사항(Requirement) 리뷰 — model-config 동시 DELETE 중복 감사 수정 (여덟 번째 자리)

## 검증 방법

저장소를 직접 뮤테이션하지 않고 `Read`/`Grep`/`grep -n`/`diff` 로만 대조 검증했다(병렬 fan-out 안전). 확인한
것: `model-config.service.ts` `remove()` 전체 본문, `model-config.service.spec.ts` 의 `mockRepo` 정의·
관련 `it`/`describe` 블록 전부, 신규 e2e 스펙 전문 및 형제 파일(`auth-config-delete-concurrency.e2e-spec.ts`)과의
`diff`, `CHANGELOG.md` 전체, `spec/5-system/3-error-handling.md`·`spec/2-navigation/6-config.md`·
`spec/2-navigation/5-knowledge-base.md`(MODEL_CONFIG_NOT_FOUND 관련 서술), `llm.service.ts` 의
`clearClientCache`/`onConfigInvalidated` 배선, 마이그레이션 `V090`/`V091` 의 FK 제약, `ModelConfig` 엔티티 및
저장소 전체의 `@OneToMany`/`cascade`/`BeforeRemove`/`AfterRemove`/`EventSubscriber` 부재. `git status --short`
는 세션 시작·종료 시 모두 깨끗했다(다른 리뷰어의 뮤테이션 잔여물 없음).

## 발견사항

- **[INFO]** 핵심 구현이 요구사항(동시 DELETE 두 건 중 진 쪽에 대한 안전한 404 처리 + 감사 1건만 기록)을 정확히 충족한다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `async remove(...)` (게이트 403~437)
  - 상세: `findEntity` → `delete({id, workspaceId})` → `affected === 0` 명시 비교 → `notFound()`(=404
    `MODEL_CONFIG_NOT_FOUND`) 던지기 → (승자만) `notifyInvalidated` → `recordAudit` 순서를 실제 코드에서 그대로
    확인했다. `affected` 판정을 `!affected` 가 아니라 `=== 0` 으로 **명시 비교**한 것도 코드상 정확히 그렇게
    돼 있다 — 드라이버가 `undefined`/`null` 을 보고하는 경우(#1371 에서 실제로 32건의 뮤턴트가 통과했던 자리)를
    "삭제 실패"로 오판하지 않는다.
  - 제안: 없음 — 요구사항 충족 확인.

- **[INFO]** 404 코드 선택(`MODEL_CONFIG_NOT_FOUND`, 형제들의 `RESOURCE_NOT_FOUND` 가 아님)이 spec 본문과 line-level 로 일치한다 (spec fidelity)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:415-420,428-429`(`private notFound()`
    재사용) / spec `spec/5-system/3-error-handling.md:85`("`MODEL_CONFIG_NOT_FOUND` | 지정 id 의 ModelConfig
    부재 또는 cross-kind 접근 차단(존재 누설 방지) — id 지정 경로 … `RESOURCE_NOT_FOUND` 의 ModelConfig 특화
    코드")
  - 상세: spec 은 이미 "id 지정 경로에서 리소스 부재는 `MODEL_CONFIG_NOT_FOUND`(404)" 를 명시하고 있고, 이번
    구현은 동시 삭제 패자를 "이미 없어진 리소스"로 취급해 같은 코드·같은 헬퍼(`this.notFound()`)를 재사용한다.
    형제 e2e(`auth-config-delete-concurrency.e2e-spec.ts`)의 단언을 그대로 베끼면 `RESOURCE_NOT_FOUND` 를
    기대하게 되어 틀렸을 자리인데, 신규 e2e(`model-config-delete-concurrency.e2e-spec.ts:111`)는 정확히
    `MODEL_CONFIG_NOT_FOUND` 를 단언한다. 클라이언트 관점에서 "존재하지 않아서 404"와 "레이스에서 져서 404"가
    구분되지 않아야 한다는 요구사항(존재 누설 방지, 위 spec 인용과 동일 원칙)에도 부합한다.
  - 제안: 없음 — 코드가 spec 과 line-level 로 일치.

- **[INFO]** `remove(entity)` → `delete(criteria)` 전환이 "동작을 바꾸지 않는다"는 코드·CHANGELOG·plan 의 실측 주장을 독립적으로 재검증했고 사실과 일치했다
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts`(`@OneToMany`/`cascade`
    0건, grep 확인) · 저장소 전체(`BeforeRemove`/`AfterRemove`/`EventSubscriber` 0건, grep 확인) ·
    `codebase/backend/migrations/V090__model_config_absorb_rerank.sql:22` · `V091__kb_embedding_model_config.sql:23`
    (둘 다 `ON DELETE SET NULL`, 인용된 줄 번호 정확)
  - 상세: 이 세 가지를 직접 열어 대조했고 코드 주석·CHANGELOG·plan 문서가 인용한 줄 번호·내용이 모두 실측과
    일치한다. "동작 등가성"이라는 강한 주장을 근거 없이 남기지 않고 검증 가능한 형태로 남긴 점이 좋다.
  - 제안: 없음.

- **[INFO]** "직전 항목의 캐시 무효화 통지 중복 예고는 과장이었다"는 이번 PR 의 정정 주장도 재검증했고 사실이었다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:81-83`(`onConfigInvalidatedListener` → `clearClientCache`
    하나뿐), `llm.service.ts:104-106`(`onConfigInvalidated` 구독이 1곳뿐, grep 확인), `clearClientCache`
    본문(게이트 145-152, `Map.delete` 기반이라 멱등)
  - 상세: 리스너가 정확히 하나(`clearClientCache`)뿐이고 그 구현이 `Map.delete()` 기반이라 중복 호출이
    안전(멱등)함을 직접 확인했다. `CHANGELOG.md` 최상단(7번째 형제 항목)의 취소선 정정과 8번째 항목의
    "직전 항목의 예고는 과장이었다" 서술이 실측과 정확히 일치한다.
  - 제안: 없음.

- **[INFO]** 단위 테스트가 요구사항의 두 축(진 쪽 완전 차단 / 드라이버 미보고 대조군)을 모두 커버하고, 전환으로 vacuous 해진 기존 단언을 능동적으로 고쳤다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:1097-1145`(`describe('remove
    — 동시 삭제', ...)`), `:360-369`(`mockRepo.remove` → `mockRepo.delete` 단언 전환), `:1063-1089`("remove
    는 조회한 엔티티의 kind 를 감사에 남긴다" — TypeORM id 파괴 흉내 mock 제거)
  - 상세: 진 쪽 테스트는 `affected: 0` → 404 `MODEL_CONFIG_NOT_FOUND` + `auditLogs.record`/`listener` 모두
    미호출을 단언하고, `it.each([[undefined],[null]])` 대조군은 정상 삭제로 취급됨(감사 호출됨)을 단언한다 —
    `!affected` 회귀(#1371 사례)를 잡을 수 있는 형태다. 기존 "삭제 **전에** kind 를 읽는다" 순서 고정 테스트는
    `delete(criteria)` 로 바뀌며 전제(엔티티 파괴)가 사라졌으므로 그 흉내(`mockRepo.remove.mockImplementation`)를
    지우고 "여전히 참인 계약(조회한 kind 를 감사에 싣는다)"만 남긴 것도 정확하다 — vacuous 단언을 방치하지 않았다.
  - 제안: 없음 — 모범 사례로 인정.

- **[INFO]** e2e 는 실제 행 락으로 겹침을 강제하고 공허성 가드까지 갖춰 회귀 방지 근거로 충분하다
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts:86-104`(`SELECT … FOR UPDATE` +
    `Promise.race` 공허성 가드), `:109-111`(`[204, 404]` + `MODEL_CONFIG_NOT_FOUND` 단언), `:117-123`(감사
    행 정확히 1건 단언)
  - 상세: `locker` 커넥션으로 대상 행을 잠근 뒤 두 `DELETE` 요청을 동시에 쏘고, 락을 놓기 **전에** 두 요청이
    아직 끝나지 않았음을 `Promise.race` 로 관측해 "겹침이 실제로 만들어졌는지"를 스스로 검증한다(이 가드가
    없으면 고치기 전 코드도 우연히 통과할 수 있다는 점을 주석이 정확히 지적한다). 형제 파일과 구조가 거의
    동일하지만(이미 이전 리뷰 라운드가 WARNING 으로 지적·plan 에 유예 결정 기록됨 — 재지적하지 않는다),
    리소스명·라우트·에러코드·request body 필드는 이 모듈에 맞게 정확히 바뀌어 있다(`diff` 로 대조 확인).
  - 제안: 없음.

- **[INFO]** 이전 `/ai-review` 라운드(`review/code/2026/09/21/16_39_52`)가 지적한 WARNING 3건이 이번 diff 로 실제로 해소됐음을 코드 레벨에서 재확인했다
  - 위치: WARNING1/2(CHANGELOG 8번째 항목 누락 + 7번째 항목의 과장 정정 부재) → `CHANGELOG.md` 최상단 두 항목에서
    해소 확인. INFO1(죽은 `mockRepo.remove` fixture) → `grep -n "mockRepo\.remove" model-config.service.spec.ts`
    0건으로 해소 확인. INFO2(e2e 주석의 거짓 인과) → e2e 주석이 "`isDefault`/`saveWithDefaultSwap` 을 전혀
    참조하지 않으므로(실측) 판별에는 영향 없다"로 정정됨을 확인. INFO11(JSDoc 부재) → `remove()` 상단에
    `@throws {NotFoundException} MODEL_CONFIG_NOT_FOUND` JSDoc 이 추가됨을 확인.
  - 상세: `RESOLUTION.md`/`_resolution_log.md`/`_resolution_state.json` 에 기록된 커밋 SHA(`5f797583f`,
    `153152d85`, `6a5571e70`)가 주장하는 변경 내용이 실제 파일 상태와 일치한다 — 기록과 실측 사이에 괴리가 없다.
  - 제안: 없음 — 문서화 관점 WARNING 은 재-flag 하지 않는다(이미 해소).

## 요약

`ModelConfigService.remove()` 를 무락 `findEntity → repo.remove(entity)`(0행이어도 던지지 않아 동시 삭제
레이스에서 감사 로그 중복을 유발) 조합에서 단일 원자적 `repo.delete({id, workspaceId})` + `affected === 0`
명시 비교로 전환한 수정이며, 요구사항(동시 DELETE 진 쪽에 안전한 404 + 감사 1건만 기록)을 코드·단위 테스트·
e2e 세 층위 모두에서 정확히 구현했다. spec 본문(`spec/5-system/3-error-handling.md` 의 `MODEL_CONFIG_NOT_FOUND`
정의)과도 line-level 로 일치하며 SPEC-DRIFT 는 없다(동시성 처리 자체는 spec 이 침묵하는 구현 세부사항이라
회색지대이고, 유일한 spec 계약 지점인 에러 코드는 정확히 재사용됐다). PR 자체가 스스로 남긴 강한 주장들
(엔티티 라이프사이클 훅 0건, FK `ON DELETE SET NULL`, 캐시 리스너 1개·멱등, 형제 e2e 와의 diff 등)을 전부
독립적으로 재실측해 사실과 일치함을 확인했고, 이전 `/ai-review` 라운드가 낸 WARNING 3건도 코드 레벨에서
실제로 해소됐음을 검증했다. 신규 CRITICAL/WARNING 은 발견하지 못했다.

## 위험도

NONE
