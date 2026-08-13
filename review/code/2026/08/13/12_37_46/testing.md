# 테스트(Testing) 리뷰

## 스코프 확인

`git diff origin/main --stat` 로 실제 변경 파일을 재확인한 결과, 이 changeset 은 **5개 파일 전부가 문서/주석성 변경**이며 실행 코드의 동작(런타임 로직)을 바꾸는 변경은 없다.

| 파일 | 변경 성격 |
|---|---|
| `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` | `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 의 docstring 2줄만 수정 ("슬라이딩 윈도우" → "fixed-window"). 코드 로직·분기·시그니처 변경 없음 |
| `plan/in-progress/backend-lint-gate-broken-on-main.md` | plan 체크리스트 항목 완료 마킹 + 완료 근거 서술 추가 |
| `spec/4-nodes/4-integration/4-cafe24.md` | §4.4 신규 절 추가(정보 이관) + §9.8 포인터 문구 조정 |
| `spec/5-system/15-chat-channel.md` | CCH-SE-02 요구사항 행에서 구현 세부(Redis 명령·키 포맷)를 빼고 `data-flow/14 §2.2` 참조로 축약 |
| `spec/conventions/redis-keys.md` | Cafe24 키 인벤토리의 상세 SoT 포인터를 `§9.8` → `§4.4` 로 갱신 |

## 발견사항

- **[INFO]** `public-webhook-quota.service.ts` 의 docstring 정정은 기존 단위 테스트와 이미 일치 — 회귀 위험 없음
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts:142-145` (docstring), 대응 테스트 `codebase/backend/src/modules/hooks/public-webhook-quota.service.spec.ts`
  - 상세: 변경은 `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 주석의 서술 정정뿐이고 `incrWithWindow`/`consumeStart` 등 실행 코드는 그대로다. 기존 `public-webhook-quota.service.spec.ts` 를 열어 확인한 결과 이미 `'EXPIRE(NX) 는 매 요청 pipeline 에 실리되 TTL 있으면 no-op — window 미연장 + 유실 self-heal'` 같은 테스트명·주석으로 **fixed-window 시맨틱을 정확히 검증**하고 있다 — 정정된 docstring 과 기존 테스트 의도가 처음부터 일치했다(플랜 문서가 주장한 "코드 자기모순"은 주석에만 있었고 테스트에는 없었음). 실행: `cd codebase/backend && npx jest public-webhook-quota.service.spec.ts` 로 재확인 가능(본 리뷰에서는 grep 으로 대조).
  - 제안: 없음. 테스트 변경 불필요.
- **[INFO]** spec 문서 구조 변경(§4.4 신설, 앵커 포인터 이동)에 대한 회귀 가드가 기존에 존재하며 이번 변경으로도 통과함을 실행으로 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (대상: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/redis-keys.md`, `spec/5-system/15-chat-channel.md`)
  - 상세: `spec-link-integrity.test.ts` 는 `spec/**.md` 전체의 상대 링크·헤딩 앵커가 실제로 존재하는지 검사하는 정적 가드다. 신설된 헤딩(`### 4.4 Private 앱 install endpoint 의 Redis 키 (normative)`)과 이를 가리키는 새 앵커(`#44-private-앱-install-endpoint-의-redis-키-normative`, `redis-keys.md`/`§9.8` 양쪽에서 참조)가 실제로 매치되는지 직접 실행해 확인했다 — `npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` → **13 passed**. `plan-frontmatter.test.ts` (plan 체크리스트/frontmatter gate) 도 `npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` → **137 passed**로 plan 파일 변경(체크박스 완료 마킹)이 gate 를 깨지 않음을 확인.
  - 제안: 없음. 기존 가드가 이번 diff 의 유일한 "테스트 대상 변경"(문서 앵커·plan frontmatter)을 이미 충분히 커버한다.
- **[INFO]** 플랜 문서가 주장한 "형제 서비스는 이미 정확했다" 주장을 실측 검증 — 사실과 일치
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` (참고, diff 밖)
  - 상세: plan md 는 `ChatChannelRateLimiterService`/`OutboundNotificationRateLimiterService` 는 이미 "fixed-window" 로 정확히 표기하고 있어 수정 대상이 아니라고 서술한다. grep 으로 확인한 결과 `chat-channel-rate-limiter.service.ts`/`.spec.ts` 모두 "fixed-window" 용어를 정확히 쓰고 있어 서술이 사실과 일치한다.
  - 제안: 없음 (검증 목적의 확인).

## 커버리지 갭 / 엣지 케이스 / Mock / 격리 / 가독성 / 테스트 용이성

해당 관점들은 **행동을 바꾸는 코드가 없어 적용 대상이 없다**. `public-webhook-quota.service.ts` 의 두 줄 docstring 변경은 컴파일·런타임 산출물에 영향을 주지 않으며, 나머지 4개 파일은 전부 `.md` 문서(plan/spec)로 코드 커버리지 개념이 적용되지 않는다(대신 문서 무결성 가드인 `spec-link-integrity`/`plan-frontmatter` 테스트가 이를 담당하며, 위에서 실행 확인함).

## 요약

이번 changeset 은 5개 파일 모두 문서·주석 성격 변경이며 런타임 로직 변경이 전혀 없다. 유일한 코드 파일(`public-webhook-quota.service.ts`)은 상수 docstring 2줄만 "슬라이딩 윈도우"에서 "fixed-window"로 정정했고, 기존 `public-webhook-quota.service.spec.ts`는 이미 fixed-window 시맨틱을 정확히 검증하고 있어 신규/수정 테스트가 불필요하다. spec 문서 구조 변경(§4.4 신설·앵커 재배치)과 plan 체크리스트 갱신은 기존 정적 가드(`spec-link-integrity.test.ts`, `plan-frontmatter.test.ts`)의 스코프 안에 있으며, 두 테스트를 직접 실행해 각각 13/13, 137/137 PASS 로 회귀 없음을 확인했다. 테스트 관점에서 추가 조치가 필요한 항목은 없다.

## 위험도

NONE
