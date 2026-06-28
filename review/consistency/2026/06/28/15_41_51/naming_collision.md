# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` (diff-base: `origin/main`)
검토 모드: impl-done

---

## 발견사항

### 발견사항 없음 — 충돌 0건

이번 변경이 도입한 신규 식별자는 다음과 같다.

| 종류 | 신규 식별자 | 도입 위치 |
|------|-----------|-----------|
| 에러 코드 | `PAYLOAD_TOO_LARGE` | `spec/5-system/3-error-handling.md §1.3`, `spec/5-system/2-api-convention.md §5.3·§6` |
| HTTP 상태코드 매핑 | `413 Payload Too Large` | `spec/5-system/2-api-convention.md §6` |
| 환경변수 | `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING` | `spec/5-system/12-webhook.md WH-NF-02·§6` |
| 파일/함수 참조 | `createHooksBodyParsers`, `createGlobalBodyParsers`, `HOOKS_ROUTE_PREFIX` | `spec/5-system/12-webhook.md §6` |
| 파일 경로 | `src/bootstrap/hooks-body-parser.ts` | `spec/5-system/12-webhook.md WH-NF-02` |

**각 항목의 충돌 여부:**

**`PAYLOAD_TOO_LARGE`**
- 기존 `spec/5-system/3-error-handling.md §1.7` 에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 가 존재하나 별개 코드이며 명칭이 다르다. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 는 공개 webhook 32KB 전용, `PAYLOAD_TOO_LARGE` 는 표준 body-parser 한도 초과(전역 100KB + 인증 webhook 1MB) 전용으로 의미가 분리돼 있고 `error-handling.md §1.3` 이 두 코드의 역할을 명시해 혼동 가능성을 없앴다. `spec/conventions/error-codes.md` 에는 `PAYLOAD_TOO_LARGE` 를 이미 다른 의미로 등록한 선례가 없다. 충돌 없음.
- `codebase/backend/src/common/filters/http-exception.filter.ts` 의 기존 구현에서 `'PAYLOAD_TOO_LARGE'` 문자열을 `origin/main` 시점에 반환하는 코드가 없었음을 확인했다(이번 PR 에서 신규 추가). 충돌 없음.

**`413` HTTP 상태코드 매핑**
- `spec/5-system/2-api-convention.md` 기존(`origin/main`) `§6` 표에 413 행이 없었다. 이번 PR 에서 최초 등재. 충돌 없음.
- 기존 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 도 `413` 을 반환하지만, 그쪽은 `spec/5-system/3-error-handling.md §1.7` 의 webhook 도메인 전용 에러 코드 카탈로그에 이미 정의돼 있으며 api-convention §6 에 중복 정의하지 않는 패턴(§6 은 일반 HTTP 상태 표준 의미만 나열)이 유지된다. 충돌 없음.

**`HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`**
- spec 전체 및 `codebase/` 에서 동일 이름으로 다른 의미로 쓰인 선례 없음. `codebase/backend/src/bootstrap/hooks-body-parser.ts` 가 이번 PR 에서 신설한 상수·환경변수. 충돌 없음.
- `.env.example` 에는 해당 변수가 문서화되지 않았다(아래 INFO 참조).

**`createHooksBodyParsers`, `createGlobalBodyParsers`, `HOOKS_ROUTE_PREFIX`**
- 이번 PR 에서 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 에 신설된 내부 함수·상수. 기존 코드베이스에 동명 식별자 없음. 충돌 없음.

**`src/bootstrap/hooks-body-parser.ts`**
- 기존에 `src/bootstrap/` 경로가 없었고(`origin/main` 에는 `main.ts` 등이 `src/` 루트에 있었음) 이번 PR 이 신설한 파일. 파일 경로 충돌 없음.

---

**INFO — `HOOKS_MAX_BODY_BYTES` env var `.env.example` 미등재**
- target 신규 식별자: `HOOKS_MAX_BODY_BYTES` (환경변수, `hooks-body-parser.ts:44`)
- 기존 사용처: `codebase/backend/.env.example` (줄 99–101) — `PUBLIC_WEBHOOK_MAX_BODY_BYTES`, `PUBLIC_WEBHOOK_STARTUP_PER_MINUTE`, `PUBLIC_WEBHOOK_HOURLY_NEW_MAX` 는 주석·예시가 있으나 `HOOKS_MAX_BODY_BYTES` 는 없음.
- 상세: 충돌은 아니나 운영자가 1MB 한도를 조정하려 할 때 env var 존재를 `.env.example` 에서 발견하지 못한다. `HOOKS_MAX_BODY_BYTES_CEILING`(상한 클램프) 도 마찬가지.
- 제안: `.env.example` 의 "Public Webhook Abuse Defense" 블록 하단 또는 별도 "Webhook Body Limits" 블록에 `HOOKS_MAX_BODY_BYTES=1048576`(기본 1MB) 및 `HOOKS_MAX_BODY_BYTES_CEILING`(기본 16MiB) 주석 예시를 추가하면 운영 가시성이 높아진다. 차단 사항은 아님.

**INFO — 프론트엔드 사용자 문서 stale**
- target 신규 식별자: 구현 완료 상태로 업데이트된 WH-NF-02 ("옵션 C, 구현")
- 기존 사용처: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (줄 97, 151), `triggers.en.mdx` (줄 86, 140) — 두 파일 모두 인증 webhook 1MB 한도를 여전히 "아직 미적용 — 예정(Planned)" 으로 기술.
- 상세: 식별자 충돌은 아니나 spec/코드가 "구현 완료"로 전환된 뒤에도 사용자 노출 문서가 stale 상태를 유지하면 외부 개발자가 혼동할 수 있다.
- 제안: `triggers.mdx`, `triggers.en.mdx` 의 해당 줄을 "인증 webhook 1MB (`PAYLOAD_TOO_LARGE`)" 완료 상태로 갱신. 차단 사항은 아님.

---

## 요약

이번 `spec/5-system/` 변경이 도입한 신규 식별자(`PAYLOAD_TOO_LARGE`, `413` 매핑, `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING`, `createHooksBodyParsers`, `createGlobalBodyParsers`, `HOOKS_ROUTE_PREFIX`, `src/bootstrap/hooks-body-parser.ts`)는 기존 spec·코드베이스·컨벤션과의 식별자 충돌이 없다. `PAYLOAD_TOO_LARGE` 는 기존의 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 공존하며 `error-handling.md §1.3` 이 역할을 명확히 분리했고, 413 HTTP 상태 행도 api-convention §6 에 최초 등재된 것으로 선점 충돌 없다. 비차단 후속 항목으로 `.env.example` 의 `HOOKS_MAX_BODY_BYTES` 미문서화 및 프론트엔드 사용자 문서 stale 두 건이 있다.

## 위험도

NONE
