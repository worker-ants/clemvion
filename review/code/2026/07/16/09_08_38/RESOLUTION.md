# RESOLUTION — 09_08_38

SUMMARY 발견 3건 처분. 모두 spec-doc 정정으로 종결(codebase 무변경 → 가드 재무장 없음).

## #1 [WARNING] "함수 개수 6 유지" 단언 2곳 — FIXED

- `spec/conventions/chat-channel-adapter.md` R-CCA-7 본문: `"함수 개수 6 을 유지해..."` → `"새 함수를 추가하지 않고 기존 함수의 시그니처만 넓혀..."` 로 count-agnostic 화. escapeControlText 가 별도 후속 신설 필수 함수임을 명시하는 괄호 주석 추가(provider 본질적 escape → 최소주의의 정당한 예외).
- `spec/5-system/15-chat-channel.md` (§b Rationale line 680): `"함수 개수 6 유지"` → `"이 결정 자체는 함수를 신설하지 않는다(기존 함수 시그니처만 확장)"` + escapeControlText 별도 신설 문장·§1 링크 추가.
- 부수: R-CCA-7 본문의 `"7번째 함수 renderPresentationNode 신설"` → `"별도 함수 renderPresentationNode 신설"` (escapeControlText 가 7번째가 된 지금 절대 순서수도 stale 이라 제거).
- 앵커 검증: `#1-adapter-interface`(영문 헤딩), `#r-cca-5-...`, `#r-cca-7-...` 실존 확인. 잔여 `"함수 개수 6/6함수"` grep 0건.

## #2 [INFO] R2 본문에 escapeControlText 설계 의도 부재 — FIXED

- `chat-channel-adapter.md` R2 본문에 문단 추가: escapeControlText 를 별도 pure 함수로 둔 이유 서술 — control-plane 안내가 `renderNode` 우회 raw 발송이라 provider 별 발송-직전 escape 필요, `sendMessage` 흡수 시 renderNode 의 이미-escape 출력을 double-escape, `renderNode` 흡수 시 우회 경로가 escape 미수령. R-CCA-5 최소주의의 정당한 예외임을 명시.

## #3 [INFO] scope — no-action

- 모든 변경이 의도(문서/주석 정정) 그대로임. 조치 불필요.

## 검증

- codebase 무변경 → lint/build/test 재실행 불요(이 RESOLUTION 델타는 spec/review 파일만).
- 문서 정정은 review 가드 트리거(codebase/**) 아님 → 가드 재무장 없음.
