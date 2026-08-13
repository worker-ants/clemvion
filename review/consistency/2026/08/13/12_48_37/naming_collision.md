# 신규 식별자 충돌 검토 — spec/4-nodes/ (--impl-done)

## 조사 방법

프롬프트에 번들된 `<git diff origin/main...HEAD -- code_areas>` 블록에는 `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` 의 주석 변경 hunk 1개만 포함되어 있었고, spec 쪽 diff 는 프롬프트에 별도로 실려 있지 않았다. 이는 impl-done 번들이 "code_areas" 만 diff 로 보여주기 때문으로 보인다. 이 gap 을 메우기 위해 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접

- `git diff origin/main...HEAD --stat`
- `git diff origin/main...HEAD -- <해당 spec 파일들>`
- `git grep` 으로 실제 코드의 기존 식별자 확인

을 수행해 실제 변경분 전체(코드 1파일 + spec 4파일)를 확인했다.

## 실제 변경 목록 (origin/main...HEAD)

| 파일 | 변경 성격 |
|---|---|
| `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` | `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 의 JSDoc 주석만 "슬라이딩 윈도우" → "fixed-window" 로 정정. 식별자·값·로직 변경 없음 |
| `spec/4-nodes/4-integration/4-cafe24.md` | 신규 `### 4.4 Private 앱 install endpoint 의 Redis 키 (normative)` 절 추가 + §9.8 블록쿼트를 "설계 근거만" 담도록 축소 |
| `spec/2-navigation/4-integration.md` | §9.8 을 가리키던 SoT 포인터 문구를 신설 §4.4 로 재지정 |
| `spec/conventions/redis-keys.md` | Redis 키 인벤토리 표의 Cafe24 행 링크를 §9.8 → §4.4 로 재지정 |
| `spec/5-system/15-chat-channel.md` | CCH-SE-02 행에서 `Redis SET NX EX 30` / 키 형태 inline 서술을 제거하고 `data-flow/14 §2.2` 포인터로 대체 |

## 발견사항

이번 diff 가 **실제로 신규 도입하는 식별자는 없다.**

- **Redis 키** `cafe24:install:nonce:<mall_id>:<timestamp>:<hmac 앞 8자>`, `cafe24:install:fail:<ip>` — 신규 §4.4 에 표로 다시 실렸지만, `git grep` 확인 결과 두 키 모두 이미 `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts` (L84), `cafe24-install-rate-limit.service.ts` (L162) 에 구현되어 있고 이전에도 §9.8 / `redis-keys.md` 인벤토리에 등재되어 있었다(diff-base `origin/main` 시점에도 존재). 이번 변경은 "Rationale 절(§9.8)에 묻혀 있던 normative 정의를 §4.4 로 승격"하는 **SoT 재배치**일 뿐 새 키가 아니다.
- **요구사항 ID** — CCH-SE-02 는 텍스트만 축약되고 ID 자체는 변경/신설되지 않았다. `spec/data-flow/14-chat-channel.md §2.2` (새로 가리키는 대상)에는 이미 동일 키(`cc:dedup:{triggerId}:{idempotencyKey}`, TTL 30초, fail-open)가 존재해 포인터가 유효하고 서술도 일치한다(dangling reference 아님).
- **엔티티/타입/함수명** — 신규 함수·클래스·인터페이스 없음. 코드 diff 는 주석 텍스트 교체뿐(`MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 자체는 불변).
- **API endpoint** — 신규 endpoint 없음.
- **이벤트/메시지명** — 신규 이벤트 없음.
- **환경변수·설정키** — 신규 ENV/config key 없음(`INSTALL_FAIL_THRESHOLD`/`INSTALL_FAIL_WINDOW_SEC` 도 기존 코드 상수 그대로, 새로 "값을 두 곳에 적지 않는다"는 서술만 보강).
- **파일 경로** — 신규 spec 파일 없음(기존 4개 파일의 절 재편집).
- **섹션 번호(`### 4.4`) 재사용 확인** — `4-cafe24.md`, `_product-overview.md`, `providers/slack.md` 세 파일이 모두 독립적으로 "### 4.4" 를 쓰고 있으나 각 문서가 별도 anchor 네임스페이스(`4-cafe24.md#44-...` vs `_product-overview.md#44-...` vs `slack.md#44-...`)이므로 실제 anchor 충돌 없음. 본 저장소 컨벤션상 문서별 독립 번호 부여가 일반적이라 WARNING 대상도 아니다.

식별할 만한 CRITICAL/WARNING/INFO 항목이 없다.

## 요약

이번 diff 는 신규 식별자를 도입하지 않는다 — 코드 변경은 주석(용어) 정정 1건뿐이고, spec 변경 4건은 모두 이미 구현·문서화되어 있던 Cafe24 install-rate-limit Redis 키 2개의 "normative 정의 위치"를 §9.8(Rationale) 에서 §4.4(본문) 로 재배치하고 3개 문서의 포인터를 그에 맞춰 갱신한 것이다. 새 요구사항 ID·엔티티·endpoint·이벤트·환경변수·파일 경로가 전혀 없으므로 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
