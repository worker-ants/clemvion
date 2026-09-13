# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 전제 확인

- **target scope(`spec/5-system/`) 델타: 0 파일** — 이 브랜치는 spec 을 전혀 바꾸지 않았다. 요구사항 ID·엔티티명·API endpoint·환경변수·spec 파일 경로 등 **spec 이 새로 부여하는 식별자는 존재하지 않는다**. 따라서 관점 1(요구사항 ID)·3(API endpoint)·5(ENV/설정키)·6(spec 파일 경로)은 대상이 없다.
- 실제 변경은 `codebase/` 21개 파일(유저 가이드 MDX 4쌍·DTO 2개·서비스 1개·신규 테스트 3개·기존 테스트 보강)이다. plan(`plan/in-progress/guide-error-code-truth.md`)에 따르면 이미 `--impl-prep`(BLOCK:NO)과 `/ai-review`+`--impl-done` 4라운드를 거쳤고, 라운드 4 의 `naming_collision` CRITICAL(`MAKESHOP_UNRESOLVED_PATH_PARAM` 오귀속)은 §J 처분으로 고쳐졌다. 아래는 그 이후 상태(HEAD)를 대상으로 신규 식별자 축만 재확인한 결과다.

## 실측 확인한 신규 식별자와 판정

| 신규 식별자 | 위치 | 판정 |
|---|---|---|
| `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` / `guide-sanitized-message-parity.test.ts` | `codebase/frontend/src/lib/docs/__tests__/` (신규 3파일) | 충돌 없음 — `ls` 로 디렉토리 30개 파일 전수 확인, 동명 파일 없음. 명명도 기존 관례(`impl-anchor-existence.test.ts`+`impl-anchor-parse.ts`, `plan-scan.test.ts`+`plan-scan.ts`)와 동형(`-existence.test.ts` / `-scan.ts` 헬퍼-테스트 분리) |
| `TestConnectionResultDto.code` (신규 필드) | `codebase/backend/.../integration-response.dto.ts` | 충돌 없음 — `spec/2-navigation/4-integration.md §9.1` 이 이미 `{success:false, code:'INTEGRATION_INCOMPLETE'}` 로 문서화해 둔 필드를 뒤늦게 선언한 것(생산자 선재, 선언 후행). 새 의미를 도입하지 않는다 |
| `testConnection` 반환 필드 `error` → `message` (rename), `latencyMs` 제거 | `codebase/backend/src/modules/llm/llm.service.ts` + `model-config-response.dto.ts` | 충돌 없음 — 형제 DTO(`ModelTestConnectionResultDto`)·프런트엔드(`model-config-manager.tsx`)가 이미 `message` 를 읽고 있었으므로 **기존 사용처와 통합**하는 rename 이지 새 의미 충돌이 아니다 |
| MDX 표에 추가된 코드 6종(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·`LLM_RESPONSE_INVALID`·`MAX_COLLECTION_RETRIES_EXCEEDED`·`WORKFLOW_FORBIDDEN_WORKSPACE` 등) | `run-results{,.en}.mdx` | 충돌 없음 — 전부 backend 에 기존재하는 코드를 정확한 카테고리에 재배치한 것(가이드가 잘못 대표 코드 하나로 뭉갰던 것을 spec §1.4 카테고리 구조로 맞춤). 새 이름을 만들지 않았다 |
| `integrations.mdx` MakeShop 예시 `MAKESHOP_API_ERROR` → `MAKESHOP_404` + 계열 설명 | `integrations{,.en}.mdx` | 충돌 없음 — `MAKESHOP_API_ERROR` 는 애초에 실재하지 않던 지어낸 이름이었고 실재 코드(`MAKESHOP_404` 등)로 교체. 라운드 4 CRITICAL 이었던 `MAKESHOP_UNRESOLVED_PATH_PARAM` 오귀속도 현재 HEAD 에서 `<Callout>` 으로 "전용 코드 없음, `INTEGRATION_CALL_FAILED` fallback + `message` 접두" 로 정정되어 있음을 재확인(diff 직접 열람) |
| `PROJECT.md` 가드 카탈로그 신규 2행 | `PROJECT.md:300-301` | 충돌 없음 — 기존 29개 항목과 문자열 중복 없음(grep 각 1건) |

## 경계선 관찰 (참고, 등급 없음)

`llm.service.ts` 의 `testConnection` JSDoc 이 스스로 지적하듯, 신규 결과 shape `{ success, message?, dimension? }` 은 전역 에러 봉투 `{ error: { code, message, ... } }` (`2-api-convention.md §5.3`)와 **필드명(`message`, 그리고 형제 엔드포인트의 `code`)을 공유**한다. 다만 (a) 이 형태는 HTTP 200 의 "결과 객체"이지 `error` 로 감싸이는 봉투가 아니어서 wire 상 중첩 위치가 다르고, (b) 형제 엔드포인트(`/api/integrations/:id/test`)가 이미 spec `§9.1` 에 동일 패턴(`{success, code, message}`)으로 선례를 만들어 놓았으므로 **새로 도입된 충돌이 아니라 기존 관례의 재사용**이다. 신규 식별자 충돌로 등급을 매길 사안은 아니라고 판단했다 — 다만 다음에 이 shape 를 또 확장할 사람은 "top-level 결과 객체의 `code`/`message`"와 "에러 봉투의 `code`/`message`"가 이름은 같고 스코프가 다르다는 점을 인지할 필요가 있다(WARNING 으로 올리지 않은 이유: 실제 소비자 코드가 두 형태를 혼동해 파싱하는 지점이 없음 — DTO 타입이 이미 분리돼 있어 컴파일 타임에 걸린다).

## 요약

target(`spec/5-system/`)이 이번 브랜치에서 새로 부여한 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·spec 파일 경로는 **없다**(scope 델타 0). 실제 구현 diff(21파일)가 도입한 식별자 — 신규 테스트 3종의 파일명, DTO 필드 rename/추가(`code`, `message`), MDX 가이드에 추가된 에러 코드 인용 — 를 전수 대조한 결과 기존 사용처와 다른 의미로 충돌하는 사례는 발견되지 않았다. 유일하게 우려됐던 오귀속(`MAKESHOP_UNRESOLVED_PATH_PARAM` 을 방출되는 코드처럼 서술)은 plan 기록상 리뷰 라운드 4 의 `naming_collision` CRITICAL 로 이미 지적·수정되었고, 이번 재확인에서도 HEAD 상태가 정정된 채로 남아 있음을 diff 로 직접 확인했다.

## 위험도

NONE
