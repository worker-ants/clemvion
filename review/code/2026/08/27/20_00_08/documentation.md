# 문서화(Documentation) 리뷰

## 검토 방법

이 diff 는 `19_36_17` 라운드(forced 7/7)의 리뷰 대상과 **동일한 코드 변경**을 담고 있고,
그 라운드의 `RESOLUTION.md` 가 적용한 두 건의 WARNING 수정(JSDoc 오귀속 2건)이 이번 diff 안에
**이미 반영된 상태**로 실려 있다(해당 라운드의 산출물 자체도 이번 diff 의 신규 파일로 포함됨).
따라서 "diff 상의 최신 상태"를 대상으로 독립적으로 재검증했다 — 이전 WARNING 이 실제로 고쳐졌는지,
새로 도입된 결함은 없는지, 이전에 deferred 된 INFO 가 여전히 유효한지를 직접 파일을 열어 확인했다.

- `Read` 로 `swagger-probe.ts` 전문을 직접 열람 — JSDoc 3중 오귀속(구 WARNING 1)이 해소되어
  `buildSwaggerDocument`(36-45줄) · `schemasOf`(59-63줄) · `schemaOf`(83-90줄) · `propertyOf`(106-111줄)
  각각 자신의 선언 바로 위에 단일 JSDoc 블록을 갖는다.
- `Read` 로 `websocket.service.spec.ts:690-829` 열람 — 옛 `_retryState`/`#1205` JSDoc(구 WARNING 2)이
  이제 `it('[캐너리] fanout 의 nodeOutput 에서 allowlist 밖 내부 필드가 제거된다', …)` (812줄) 바로
  위(800-811줄)에 정확히 재배치돼 있다. describe 블록 자체에도 분리 이유를 설명하는 별도 JSDoc(791-798줄)이
  붙어 있어 두 문서가 섞이지 않는다.
- `grep` 으로 `buildSwaggerDocument({ … })` 호출부 4곳을 대조 — JSDoc 이 주장하는 "네 스펙 중
  셋은 `controllers`, 하나(`re-run.dto.spec.ts`)는 `imports`" 가 실측과 정확히 일치(3:1 확인).
- `grep -rn "EIA-AU-09"` 저장소 전체 — `codebase/`·`spec/`·활성 `plan/in-progress` 본문에는 **0건**,
  남은 참조는 전부 `plan/complete/`·`review/**` 의 동결된 이력 기록뿐(이 프로젝트 관례상 이력은
  원문 보존 대상이라 정상).
- `grep -rn "shared/utils/node-output-allowlist"` — `codebase/`·`spec/` 0건, `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md` 본문도 0건(신규 경로 `nodes/core/node-output-allowlist.ts`
  로 완전히 갱신됨 — 이전 라운드가 지적한 "미완료 항목의 구 경로 안내" INFO 도 이번에 함께 해소됨).
- `redact-stored-error.ts` 의 `@param`/`@returns` 보강, `maskIfPresent` 옆 제네릭 비대칭 설명 추가를
  직접 읽어 확인 — 서술이 실제 코드(제네릭 추론 출처 차이)와 일치.
- `interaction.guard.ts:27` 을 직접 열람 — `+ §3.3.1 EIA-AU-09` → `+ §3.3.1` 로 정정되어 있고 §3.3.1
  자체는 실재하는 절이므로 참조가 깨지지 않았다.
- `CHANGELOG.md` 확인 — 이 저장소의 CHANGELOG 관례는 **운영/사용자 영향이 있는 변경**(예: 최상단
  기존 항목 "config 마스킹을 저장 시점에서 egress 로 이동" — DB 저장값이 바뀌는 실제 동작 변화)만
  기록한다. 이번 PR 은 rename·파일 이동·테스트 헬퍼 추출로 **동작 무변경**(security.md 실측: 마스킹
  로직·allowlist 키 목록·인증 가드 로직 바이트 단위 보존)이므로 CHANGELOG 갱신 대상이 아니다.

## 발견사항

(없음 — CRITICAL·WARNING 없음)

## 참고 (INFO, 신규 아님 — 이전 라운드에서 이미 검토·의식적으로 defer됨)

- **[INFO]** `buildSwaggerDocument` JSDoc 이 명시하는 핵심 보장("`createDocument` 가 던져도
  `finally` 로 `app.close()` 가 실행된다")을 직접 검증하는 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` — `buildSwaggerDocument` 함수의
    JSDoc(36-39줄)과 본문(46-57줄) / `codebase/backend/src/shared/testing/swagger-probe.spec.ts`
    (해당 케이스 부재, 42-50줄 근처에 에러 경로 테스트만 있음)
  - 상세: `19_36_17` RESOLUTION 이 "과대 주장이 아니고, 테스트하려면 Nest 내부(`NestApplication.prototype.close`)에
    결합돼야 해 그 비용이 방어의 값보다 크다"는 이유로 명시적으로 defer 했다. 문서 자체는 여전히
    정확하고(구현이 실제로 `finally` 를 쓴다) 과대 주장은 아니므로 CRITICAL/WARNING 급은 아니다.
  - 제안: 우선순위 낮음, 조치 불요 — 기존 판단 유지 권장.

## 요약

이 diff 는 순수 위생(hygiene) 리팩터(Swagger 테스트 보일러플레이트 공유 헬퍼 추출, 함수 리네임,
파일 재배치, 낡은 spec-ID 주석 정정, 테스트 `describe` 재배치)이며, 직전 리뷰 라운드(`19_36_17`)가
지적한 두 건의 WARNING(신설 `swagger-probe.ts` 의 3중 JSDoc 오귀속, `websocket.service.spec.ts` 의
JSDoc 이동 누락)이 **모두 해소된 상태로 이번 diff 에 반영**되어 있음을 파일을 직접 열어 독립적으로
확인했다. `buildSwaggerDocument` JSDoc 의 수치 서술(3:1)·`EIA-AU-09` 오기 제거·`node-output-allowlist.ts`
재배치에 따른 spec/plan 문서 동기화도 모두 grep 실측과 일치한다. README/CHANGELOG 는 이번 변경이
동작 무변경 내부 리팩터이므로 갱신 대상이 아니며 실제로도 누락되지 않았다. 유일하게 남은 항목은
이전 라운드가 근거와 함께 의식적으로 defer 한 낮은 우선순위 INFO 하나(`buildSwaggerDocument` 의
try/finally 보장에 대한 회귀 테스트 부재)로, 문서 자체의 정확성 문제는 아니다.

## 위험도

NONE
