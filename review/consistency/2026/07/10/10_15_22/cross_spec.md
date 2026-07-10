# Cross-Spec 일관성 검토 — SECRET_LEAK_PATTERNS 확장 (bare JWT + URI userinfo)

## 검토 방법 / 유효성 확인

프롬프트에 인라인된 target(`spec/5-system/1-auth.md` 등)은 이 태스크와 무관한 템플릿 anchor로
판단되어 무시했다. 대신 지시대로 실제 diff 를 직접 확인했다:

```
git diff origin/main...HEAD --stat
```

실제 변경분은 다음 8개 파일뿐이며 **spec/ 변경은 0건**이다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (+13/-1) — `SECRET_LEAK_PATTERNS`에 bare JWT·URI-userinfo 정규식 2개 추가
- `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (+48) — positive/FP 가드 테스트
- `review/code/2026/07/10/10_05_20/*`, `review/code/2026/07/10/10_14_41/*` — 선행 `/ai-review` 산출물 (RESOLUTION/SUMMARY/reviewer 리포트, 코드 아님)

즉 이번 target 은 **spec 문서가 아니라 코드**이며, 순수 additive 한 공용 secret-redaction 유틸(`shared/utils/sanitize-error-message.ts`)의 패턴 확장이다. Cross-Spec 검토는 이 코드 변경이 `spec/**` 의 기존 서술(특히 이 유틸을 SoT 로 참조하는 문서들)과 모순되는지에 초점을 맞췄다.

## 영향 범위 확인

`SECRET_LEAK_PATTERNS` 를 참조하는 spec 문서 4곳을 확인:

- `spec/5-system/11-mcp-client.md` (§8.3, Rationale "에러 message redaction 은 공용 패턴 재사용")
- `spec/5-system/14-external-interaction-api.md` (§R17)
- `spec/conventions/conversation-thread.md`
- `spec/2-navigation/4-integration.md`

코드 소비처(`grep -rl SECRET_LEAK_PATTERNS codebase/backend/src`)는 6곳: `shared/utils/sanitize-error-message.ts`(정의부), `shared/conversation-thread/thread-renderer.ts`, `modules/execution-engine/sanitize-error-message.ts`, `modules/mcp/mcp-error-codes.ts`, `modules/integrations/integration-oauth.service.ts`(+spec), 대부분은 `redactSecrets`/`SECRET_LEAK_PATTERNS` 를 그대로 재사용하는 얇은 wrapper 라 이번 추가와 충돌 소지가 없다. 유일하게 실질적 상호작용이 있는 곳은 `modules/mcp/mcp-error-codes.ts` 다.

## 발견사항

- **[WARNING] `spec/5-system/11-mcp-client.md` 의 "공용 패턴 미커버" 서술이 이번 코드 변경으로 stale 해짐 + 정규식 중복**
  - target 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 신규 라인 — `SECRET_LEAK_PATTERNS` 에 추가된 URI-userinfo 패턴 `/\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/gi` (모든 scheme 의 `user:pass@` 매칭 후 스킴까지 포함해 전체를 마스킹)
  - 충돌 대상: `spec/5-system/11-mcp-client.md` §8.3 (line 481) 및 Rationale "에러 message redaction 은 공용 패턴 재사용" (line 587) — "공용 `SECRET_LEAK_PATTERNS`... 그것이 다루지 않는 MCP 특화 케이스(**connect URL userinfo**·쿼리 bare token)만 얇게 얹는다" / 구현측 주석(`codebase/backend/src/modules/mcp/mcp-error-codes.ts:40-46`)도 동일하게 "connect URL userinfo (`scheme://user:pass@host`)... **공용 패턴에는 없음**" 이라고 명시
  - 상세: 이 spec 서술과 코드 주석은 "URL userinfo 마스킹은 공용에 없어서 MCP 가 자체 패턴(`MCP_EXTRA_SECRET_PATTERNS[0]` = `/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi`)으로 보강한다"는 전제를 깔고 있는데, 이번 diff 로 공용 `SECRET_LEAK_PATTERNS` 자체가 (DB 한정이 아닌) **모든 scheme 의 URI userinfo** 를 커버하게 됐다. 결과적으로 (a) spec 의 "공용 패턴에는 없음" 주장이 더 이상 사실이 아니고, (b) 두 군데(`shared/utils/sanitize-error-message.ts`·`modules/mcp/mcp-error-codes.ts`)에 사실상 동일한 정규식이 중복 존재하게 됐다 — 바로 그 Rationale 이 피하려던 "secret 패턴 SoT 파편화" 상황이 (반대 방향으로) 재현된 것이다. 기능적으로는 깨지지 않는다(MCP 쪽이 먼저 마스킹해 `***@` 로 치환하므로 공용 패턴은 이미 마스킹된 텍스트에 대해 no-op, 실측 회귀 400 suite 통과 — `review/code/2026/07/10/10_05_20/RESOLUTION.md` 확인됨) — 이번 코드 리뷰(security/testing)도 INFO 로만 "MCP 는 자체 userinfo 패턴(PR #842)이 선행이라 net-new 방어는 bare-JWT 한정"이라고 언급했지만, **spec 문서(`11-mcp-client.md`) 텍스트 자체의 갱신은 다루지 않았다** — 코드 리뷰 스코프 밖이라 이번 cross-spec 검토에서 처음 표면화됨.
  - 제안: `spec/5-system/11-mcp-client.md` §8.3(line 481)·Rationale(line 587)을 갱신해 "URL userinfo 는 이제 공용 `SECRET_LEAK_PATTERNS` 가 커버하며, MCP 전용 패턴은 하위호환/역사적 중복(또는 쿼리 bare-token 만 잔존)"으로 재서술. 선택지: (1) spec 만 정정(코드는 유지, 중복이지만 안전), 또는 (2) `MCP_EXTRA_SECRET_PATTERNS` 의 URI-userinfo 항목을 제거하고 공용 패턴에 위임 후 spec·코드 주석 동시 정리(코드 변경 필요 — 이번 target 범위 밖이므로 별도 후속 plan 권장). 어느 쪽이든 "공용 패턴에는 없음" 이라는 두 군데(spec + `mcp-error-codes.ts` 주석)의 텍스트는 현재 사실과 어긋나므로 최소 spec 갱신은 필요.

- **[INFO] `spec/5-system/14-external-interaction-api.md` §R17 / `spec/conventions/conversation-thread.md` 는 정합**
  - target 위치: 신규 정규식 2개 (bare JWT, URI userinfo) 및 코드 주석 "EIA §R17 잔여 하드닝"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` line 1148 ("모든 마스킹은 `shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`... 재사용")
  - 상세: 이 문서는 구체적 정규식 목록을 나열하지 않고 "공용 SoT 재사용"만 서술하므로, 패턴이 추가돼도 문서 정확성이 훼손되지 않는다. 오히려 이번 변경은 §R17 이 이미 선언한 "노드 핸들러가 turn 텍스트에 남긴 민감정보를 SECRET_LEAK_PATTERNS 로 마스킹" 보장을 강화하는 방향(bare JWT·비-DB URI 자격증명까지 커버)이라 spec 의도와 일치한다. 갱신 불요, 참고용으로만 기록.

- **[INFO] `spec/2-navigation/4-integration.md` (line 1482, Cafe24 HMAC 진단 로그)와도 충돌 없음**
  - target 위치: 신규 정규식 2개
  - 충돌 대상: `spec/2-navigation/4-integration.md` line 1482 — "`client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관"
  - 상세: 이 문서는 정책 방향성만 참조하고 세부 정규식을 규정하지 않으므로 이번 additive 확장과 모순되지 않는다.

## 요약

이번 diff 는 spec 변경 없이 공용 secret-redaction 유틸(`shared/utils/sanitize-error-message.ts`)의 `SECRET_LEAK_PATTERNS` 에 bare JWT·URI-userinfo 정규식 2개를 순수 추가하는 코드 전용 변경이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서는 어떤 spec 영역과도 충돌하지 않는다(해당 관점 자체가 이 변경과 무관). 다만 새로 추가된 URI-userinfo 패턴이 `spec/5-system/11-mcp-client.md` 가 "공용 패턴에는 없다"고 명시적으로 서술해온 케이스(scheme://user:pass@host)를 이제 공용 레벨에서도 커버하게 되면서, 그 spec 문서의 Rationale 서술이 stale 해지고 코드 상 두 곳(shared + MCP 전용 `mcp-error-codes.ts`)에 사실상 동일한 정규식이 중복 존재하는 상태가 됐다 — 기능 회귀는 없으나(먼저 적용되는 MCP 패턴이 선행 마스킹) spec 문서 정확성·"SoT 파편화 방지"라는 그 문서 자신의 설계 원칙과는 어긋나므로 WARNING 으로 보고한다. 나머지 참조 spec(EIA §R17, integration §HMAC 로그)은 공용 SoT 재사용만 선언하고 세부 패턴을 규정하지 않아 이번 확장과 정합적이다.

## 위험도

LOW
