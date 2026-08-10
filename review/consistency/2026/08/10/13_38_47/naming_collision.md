# 신규 식별자 충돌 검토 — naming_collision

대상: `spec/7-channel-web-chat` (--impl-done, diff-base=origin/main)

## 검토 범위 확인

`git diff origin/main...HEAD` 기준 이번 변경은 매우 좁다:

- spec: `spec/7-channel-web-chat/3-auth-session.md` 1개 파일만 변경 (frontmatter `status: implemented → partial` + `pending_plans:` 추가, §3.1/§R4/§R7 산문 정정 — "boot 세대 재확인" 표현을 "스트림 열기 진입 재확인"으로 교체)
- code: `codebase/channel-web-chat/src/widget/use-widget.ts` + 그 테스트 — `sessionEstablished()` 재확인을 호출부 2곳에서 `openStream()` 내부로 이동, 신규 판별 유니온 타입 `StreamClaim`(`"opened" | "already_owned" | "no_client"`) 도입

번들된 나머지 spec 파일(`2-sdk.md`, `1-widget-app.md`, `4-security.md`, `_product-overview.md`, `0-architecture.md`, `5-admin-console.md`)과 plan 목록은 컨텍스트일 뿐 이번 diff 로 변경되지 않았다.

## 신규 식별자 인벤토리 및 충돌 점검

1. **타입명 `StreamClaim`** (`use-widget.ts:104`) — 코드베이스 전체(`codebase/`)·spec 전체에서 `grep -rn "StreamClaim"` 결과 이 파일 1곳에만 존재. 충돌 없음.
2. **유니온 값 `"opened"` / `"already_owned"` / `"no_client"`** — 세 리터럴 모두 `use-widget.ts` 로컬 스코프에서만 쓰이고 spec 문서 어디에도 동일 리터럴이 다른 의미로 정의돼 있지 않다. 단, 백엔드 쪽에 문자열상 유사한 `no_client_secret`(`integration-oauth.service.ts`) · `__no_client_ip__`(`public-webhook-quota.service.ts`) 리터럴이 있으나 완전히 다른 도메인(OAuth 자격증명 검증 / IP rate-limit 버킷)이고 타입 유니온을 공유하지도, 서로 참조하지도 않아 실질적 혼동 가능성이 낮다. 참고용으로만 기록(비차단).
3. **함수명 `openStream`** — 위젯 훅 레벨 `use-widget.ts` 의 `openStream` 과 EIA 클라이언트 레벨 `eia-client.ts` 의 `openStream` 두 계층에 동명 함수가 존재하지만, 이는 이번 diff 가 새로 만든 것이 아니라 기존부터 있던 "훅이 클라이언트 메서드를 감싸 동명으로 노출" 패턴이다(diff 는 반환형만 `void → StreamClaim` 로 바꿨을 뿐 함수를 신설/개명하지 않음). 신규 식별자 충돌 범주 밖.
4. **frontmatter 키 `pending_plans:`** — `spec/conventions/spec-impl-evidence.md` 에 정식 정의된 기존 컨벤션 키이며 이미 10개 이상 다른 spec 파일(`5-system/14-external-interaction-api.md`, `5-system/4-execution-engine.md`, `4-nodes/3-ai/1-ai-agent.md` 등)에서 동일 의미로 쓰이고 있다. `3-auth-session.md` 의 신규 사용은 그 컨벤션(`status: partial` 시 의무)에 정확히 부합하며 충돌이 아니라 정합 사용.
5. **참조 plan 경로 `plan/in-progress/webchat-reload-rest-error-branches.md`** — 실존 파일이며(`find plan/in-progress -iname "*webchat*"` 확인) 동명·유사명 파일과의 경합 없음. 그 plan 문서 자체가 "`3-auth-session.md` 가 가리키는 유일한 `pending_plans`"라고 스스로 밝히고 있어 참조 방향도 일치.
6. **요구사항 ID/엔드포인트/이벤트명/ENV 변수** — 이번 diff 범위에 신규 도입 없음(§R 번호 재사용 없음, `EIA-*`/`WH-*` 등 기존 ID 신설 없음, endpoint·webhook·SSE 이벤트명 변경 없음).

## 발견사항

없음. 이번 변경 범위(가드 위치 이동 + 판별 유니온 타입 1개 + status/pending_plans frontmatter 업데이트)에서 기존 사용처와 의미가 다른 방식으로 재사용된 식별자를 찾지 못했다.

## 요약

이번 target 변경은 `3-auth-session.md` 단일 spec 파일의 상태 재분류(`implemented → partial` + `pending_plans` 추가)와 그에 대응하는 `use-widget.ts` 리팩터(호출부 중복 가드를 `openStream()` 진입부로 흡수, `StreamClaim` 판별 유니온 신설)로 범위가 좁다. 신설된 타입·리터럴·frontmatter 키·plan 경로 전부를 코드베이스·spec 전수 검색으로 대조한 결과 기존 사용처와 의미가 충돌하는 사례는 없었다. `pending_plans:` 사용은 오히려 기존 컨벤션을 정확히 따른 것이고, `openStream` 동명 이슈는 이번 diff 가 만든 것이 아니라 이전부터 존재하던 계층 간 명명 패턴이다.

## 위험도

NONE
