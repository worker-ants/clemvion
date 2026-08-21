STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17, `origin/main` 대비 브랜치 전체)

## 검토 방법

`git log origin/main..HEAD`(9 커밋) + `git diff origin/main...HEAD --stat -- codebase/`(12파일,
+987/-11)로 실질 애플리케이션 코드 범위를 확정했다. 이 브랜치는 이미 6라운드
(`00_03_57`→`02_29_01`)의 자체 코드 리뷰를 거쳐 CRITICAL 1건(boolean 마커 완전 우회) +
WARNING 다수(호출부 중복·`errors`→`details` 봉투 유실·spec 시점 서술 drift·가드 자체 결함
셋)를 전량 수정·수렴시킨 상태다(`review/code/2026/08/21/02_29_01/RESOLUTION.md` 최종
CRITICAL 0/WARNING 0). 본 라운드는 그 수렴 주장을 그대로 믿지 않고, 핵심 파일 6개를
`Read`로 직접 열어 실코드-spec-테스트 3자 대조를 독립 수행했다:

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (+.spec.ts)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (+.spec.ts)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
- spec 5곳: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6, `spec/5-system/3-error-handling.md`
  §1.3/§1.7, `spec/5-system/12-webhook.md` §5.2, `spec/5-system/14-external-interaction-api.md`
  §R17, `spec/1-data-model.md`

## 발견사항

- **[INFO]** repo-guard(`masked-reject-callers-guard.ts`)의 `importsBaseFn` 은 정규식 기반이라
  namespace import(`import * as base from ...`)·re-export·동적 `require()` 형태의 우회를
  탐지하지 못한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수
    `importsBaseFn`(게이트 73-84)
  - 상세: 현재 실제 호출부(`executions.service.ts`, `workflows.controller.ts`) 둘 다 named
    import 로 정상적으로 wrapper 를 쓰고 있어 즉시 위험은 없다. 코드 자체 주석이 "AST 파서
    대신 정규식을 쓴 트레이드오프"를 명시적으로 인지하고 있고, 이미 `02_29_01` 라운드에서
    독립적으로 같은 결론(INFO, 조치 불요)에 도달했다 — 이번 라운드에서도 재확인만 하고
    등급을 올릴 근거를 찾지 못했다.
  - 제안: 조치 불요. 향후 실제 namespace-import/re-export 형태의 Manual 경로가 생기면
    그때 탐지 패턴을 확장(또는 AST 파서 전환).

- **[INFO]** re-run(`INVALID_INPUT`)과 execute(`INVALID_TRIGGER_PARAMETERS`)의 최상위
  `error.code` 가 여전히 다르다 — 이 PR 의 범위는 아니다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:506`,
    `codebase/backend/src/modules/workflows/workflows.controller.ts` (`INVALID_TRIGGER_PARAMETERS`
    throw 지점)
  - 상세: `details[].code` 는 이 PR 이 `MASKED_VALUE_RESUBMITTED` 로 두 경로 모두 완전히
    수렴시켰다(실코드 확인 — 두 catch 블록 다 `toTriggerParameterErrorDetails(err.errors)` 를
    거친다). 최상위 코드 drift 는 이 PR 이전부터 있던 것이고 spec(`3-error-handling.md:80`)도
    "`RERUN_` prefix 를 붙이지 않는 것은 의도 — rename-stability 상 유지"라고 명시적으로
    현재 상태를 정당화한다. 통일하려면 기존 클라이언트가 보는 최상위 코드가 바뀌는 별도
    breaking 결정이 필요하다.
  - 제안: 이 PR 스코프 밖. 다음에 두 봉투를 통일할 기회가 생기면 처리.

## 검증 결과 요지 (발견사항이 아니라 확인 로그)

- **기능 완전성**: `resolveTriggerParametersRejectingMasked` 가 raw(coerce 전) 우선 검사 →
  `resolveTriggerParameters` → resolve 후 재검사(JSON 문자열로 실린 object/array 대비)의
  2단계 구조로 구현돼 있고, 두 Manual 진입점(re-run `inputOverride`, execute
  `parameterValues`/legacy `input.parameters`) 모두에 배선돼 있음을 실코드로 확인. 세 마커
  리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 전부 `MASKED_MARKERS`(이제 진짜
  `Object.freeze` 된 `readonly string[]`)를 통해 egress 마스킹과 공유 판정된다.
- **엣지 케이스**: 정확 일치만(부분 포함 `a***b` 통과) · 깊이 상한이 `MAX_REDACT_DEPTH`
  경계(및 +1)에서 정확히 갈림 · object/array 혼합 중첩에서 보폭 일치 · depth 5000 스택
  안전성 · `defaultValue` 로 채워진(사용자가 안 건드린) 필드는 과잉 차단하지 않음 · 스키마
  없음/빈 배열/`rawSource` 가 `null`·비객체인 경우 pass-through — 모두
  `reject-masked-resubmission.spec.ts` 테스트로 고정돼 있음을 직접 읽어 확인.
- **TODO/FIXME/HACK/XXX**: 변경된 8개 핵심 파일 전체 grep 결과 0건.
- **의도-구현 일치**: `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`/
  `hasMaskedLeaf` 의 JSDoc 이 서술하는 "raw 기준 대상 키 선정", "값 검사가 깊이 검사보다
  먼저", "webhook/schedule 은 대상 아님" 이 실제 구현·repo-guard 허용목록과 정확히 일치.
- **에러 시나리오**: `TriggerParameterValidationException` → 두 호출부 모두
  `BadRequestException({ code, message, details: toTriggerParameterErrorDetails(err.errors) })`
  로 정규화. re-run 의 선존 `errors` vs `details` 키 불일치(≡ `GlobalExceptionFilter` 가
  `details` 만 읽어 필드별 내역이 조용히 유실되던 버그)가 이번 diff 로 함께 교정됨을
  `http-exception.filter.ts` 실코드 인용까지 대조해 확인.
- **데이터 유효성**: `findMaskedResubmissions` 는 `isRecord` 가드로 `rawSource`/`values` 비객체
  입력을 안전하게 걸러내고, 스키마에 정의된 필드 중 `rawSource` 에 실제로 존재하는(`hasOwnProperty`)
  것만 대상으로 삼아 `defaultValue` 자동 채움 필드를 과잉 차단하지 않는다.
- **비즈니스 로직**: 판정 기준이 "출처"가 아니라 "페이로드의 저작 주체"라는 spec 원칙
  (`spec/5-system/14-external-interaction-api.md:1582`)이 코드 스코프(Manual 두 경로만 wrapper
  사용, webhook/schedule 은 base 함수 직접 사용)와 정확히 일치.
- **반환값**: `resolveTriggerParametersRejectingMasked` 는 정상 경로에서 항상
  `Record<string, unknown>` 을 반환하거나 예외를 throw — 반환 누락 경로 없음.
- **spec fidelity (line-level)**: `spec/4-nodes/7-trigger/1-manual-trigger.md:170`("adapter
  `resolveTriggerParameters` **전후** 2단계 — raw 우선 검사 → resolve → resolve 후 재검사")이
  실제 함수 구조와 정확히 대응하고, `:197-210` 의 "왜 '직후'가 위험한가" 표가 CRITICAL 재발
  방지 근거로 남아 있음을 확인. `spec/5-system/3-error-handling.md:193`, `spec/5-system/12-webhook.md:312`,
  `spec/1-data-model.md:471` 모두 "Manual 실행 경로 한정(저작 주체 기준)"으로 일관되게
  정정돼 있어(`plan/complete/spec-update-masked-reject-framing.md` 가 예고한 3+1곳 정정이
  실제로 전부 반영됨), 이전 라운드가 지적했던 "재제출 경로 한정" SPEC-DRIFT 잔여를 발견하지
  못했다.

## 요약

이 브랜치(9 커밋, `codebase/` 12파일 +987/-11)는 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)의
Manual 실행 경로(re-run `inputOverride`, execute `parameterValues`/legacy `input.parameters`)
재제출을 서버측에서 거부하는 기능을 구현한다. 6라운드에 걸친 자체 리뷰가 CRITICAL 1건(boolean
완전 우회)과 다수 WARNING(호출부 중복, 에러 봉투 유실, spec 시점 서술 drift, 자체 도입한
repo-guard의 결함 셋 포함)을 전량 수정해 수렴시켰다는 주장을, 핵심 구현·테스트·연관 spec
5곳을 직접 열어 line-level 로 독립 재검증했다. raw-우선/resolve-후 2단계 검사 구조, 정확
일치·깊이 상한 경계, Manual-only 스코프, 에러 코드/메시지 매핑, `errors`→`details` 봉투
교정이 모두 실코드·테스트·spec 서술과 정확히 정합하며, 새로 발견한 CRITICAL·WARNING 은
없다. 남은 INFO 2건(repo-guard 의 정규식 스코프 한계, 최상위 `error.code` 선존 drift)은
모두 이전 라운드에서 이미 동일 등급으로 처분된 항목의 재확인이며 이번 diff 가 새로 만든
결함이 아니다.

## 위험도

NONE
