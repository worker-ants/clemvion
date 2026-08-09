# Cross-Spec 일관성 검토 — webchat spec Rationale 갭 후속 (§R7·§R8 + 4-security §1 + 2-sdk §3)

검토 대상(워크트리 uncommitted diff): `spec/7-channel-web-chat/3-auth-session.md`(§R7·§R8 신설),
`spec/7-channel-web-chat/4-security.md`(§1 "저장 세션의 발급-origin 바인딩" 행 신설),
`spec/7-channel-web-chat/2-sdk.md`(§3 `wc:boot` 재전송 절에 apiBase 예외 각주).

## 검토 방법

`git diff` 로 실제 추가분을 확인한 뒤, 관련 문서군 전체를 읽어 4가지 지시 관점 + 일반 Cross-Spec 관점
(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)을 적용했다. `spec/` 전체에서 `apiBase` 를
grep 해 `7-channel-web-chat/` 밖에서 이 개념을 재정의하는 곳이 있는지도 확인했다(없음 — 개념이 이 영역에
고립돼 있어 데이터 모델 충돌 여지 자체가 없다).

## 발견사항

- **[INFO]** `1-widget-app.md §3.1` "새 대화(restart)" 트리거 열거에 apiBase-변경 재부팅이 빠져 있음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §R8 (및 그 정책 본문 §3.1-1, diff 밖이지만
    이미 구현됨) · `2-sdk.md §3` 신설 각주
  - 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "채팅 종료 / 새로 시작 / 세션 지속" 표 —
    "새 대화 (restart)" 행의 트리거 열거는 `[ended] CTA · 헤더 "새 대화" · host resetSession` 세 가지뿐이고,
    "apiBase 가 바뀐 wc:boot 재전송"은 트리거로 등재돼 있지 않다.
  - 상세: 기능적으로는 두 경로(host `resetSession`, apiBase-변경 재전송)가 같은 결과(저장 세션 폐기 →
    새 세션 시작)에 도달하지만, `1-widget-app.md` 의 상태기계 표는 그 트리거를 나열하지 않는다. 다만 이는
    **모순이 아니라 의도된 SoT 분리**다 — `2-sdk.md` 프런트매터 코드 주석이 이미 "이 문서가 `wc:boot` 재전송
    계약의 SoT — `1-widget-app.md` 는 재전송을 서술하지 않는다"고 명시하고 있고(파일 헤더 6~7행), 실제로
    `1-widget-app.md` 본문 전체에 `재부팅`/`wc:boot` 언급이 전혀 없다(재전송/재연결 등 다른 용어만 등장).
    즉 이번 변경이 새로 만든 갭이 아니라 기존 설계 경계를 그대로 따른 것이다.
  - 제안: 액션 불필요(기존 SoT 분리가 문서화돼 있음). 다만 완전성을 높이고 싶다면 `1-widget-app.md §3.1`
    표 각주에 "apiBase 변경 재부팅에 의한 세션 폐기·재시작은 [2-sdk §3](./2-sdk.md) 참조"를 한 줄 추가하는
    선택지가 있다 — 필수는 아니고 discoverability 개선 수준.

- **[INFO]** 신설 상호 링크 3개는 파일 단위로는 해소되나 절 앵커(fragment)가 없음 — 기존 관행과 일치
  - target 위치: `4-security.md §1` 신설 행의 "근거 [3-auth-session §R8](./3-auth-session.md)",
    `2-sdk.md §3` 각주의 "([3-auth-session §R8](./3-auth-session.md))",
    `3-auth-session.md §R8` 말미의 "관련 위협 축은 [4-security §1 ...](./4-security.md)"
  - 충돌 대상: 없음(모순 아님) — 다만 세 링크 모두 `#r8-...`/`#1-보안-정책-요약` 같은 절 앵커 없이 파일
    루트로만 연결된다.
  - 상세: 세 링크 다 **대상 파일 자체는 정확**하고 존재하며 깨진 링크(broken link)는 아니다. 클릭하면
    올바른 문서로 이동하지만 §R8/§1 정확한 위치로 스크롤되지는 않는다(프로즈의 "§R8"/"§1" 표기로 독자가
    수동 탐색). 이 저장소는 실제로 두 스타일이 혼재한다 — Rationale 항목(`### R6.` 류) cross-file 참조는
    거의 전부 파일-only 링크(예: 기존 `[1-widget-app §R9](./1-widget-app.md)`, `[3-auth-session §R6](./3-auth-session.md)`
    가 이미 이 패턴), 반면 숫자절(`## 1`, `### 1.1`) cross-file 참조는 종종 정밀 앵커를 쓴다(예:
    `spec/3-workflow-editor/4-ai-assistant.md` 가 `4-security.md#11-마크다운html-sanitize-정책-매트릭스`
    로 §1.1 을 정확히 가리킴). 이번 3개 신규 링크는 **Rationale-대-Rationale 참조**라 다수 관행(파일-only)을
    따른 것이므로 회귀가 아니다.
  - 제안: 액션 불필요. 원한다면 `#r8-저장-세션은-발급-apibase-에-바인딩--재전송이-origin-을-바꾸면-폐기`
    형태의 정밀 앵커로 승격할 수 있으나, 기존 Rationale 상호참조 다수가 같은 느슨한 스타일이라 이 3개만
    바꾸면 오히려 스타일 비일관을 만든다.

## 점검 관점별 결과 (모두 충돌 없음)

1. **데이터 모델 충돌** — `apiBase` 개념은 `spec/7-channel-web-chat/` 에만 존재(전체 `spec/` grep 확인),
   다른 영역에 동일/유사 필드의 상충 정의가 없다. `4-security.md §1` 신설 행이 참조하는 `executionId`+토큰
   구조도 `3-auth-session.md §2`·§R3 의 기존 per_execution 모델을 그대로 재인용할 뿐 새 필드를 만들지 않는다.
2. **API 계약 충돌** — 신설 서술은 순수 **클라이언트측 판단 로직**(`loadSession(path, apiBase)` 이 저장값과
   현재값을 비교)이며 EIA HTTP 계약(`GET /api/external/executions/:id` 등)에 새 파라미터·shape 변경을
   요구하지 않는다. `5-system/14-external-interaction-api.md` 의 `iext_*` JWT 는 `{sub: executionId, aud:
   'interaction', jti}` 만 담고 origin/apiBase 를 인코딩하지 않으므로(§7.3) 서버측 토큰 검증 계약과 무관 —
   R8 이 "발급 origin 바인딩"이라 부르는 것은 서버 계약이 아니라 클라이언트 로컬 정책이다. 서버는 여전히
   jti/blacklist 만으로 검증하며 이 변경이 서버 API 계약을 건드리지 않는다는 서술과 일치한다.
3. **요구사항 ID 충돌** — `R7`/`R8` 은 `3-auth-session.md` 파일 스코프의 Rationale 순번(직전 최댓값이
   R6)이라 그 문서 안에서 유일하고, EIA 류 전역 요구사항 ID(`EIA-RL-07` 등 `PREFIX-CATEGORY-NN` 패턴)와
   네임스페이스가 다르므로 의미 충돌 가능성이 없다.
4. **상태 전이 충돌** — `1-widget-app.md §3` ASCII 상태기계·§3.1 표와 `3-auth-session.md §R7`(표면 되감기
   방어 축)·`§R8`(세션 폐기·재시작) 서술을 대조한 결과, 두 문서가 같은 전이를 다른 트리거·다른 결과로
   기술하는 곳은 없다. §R7 은 SSE 재연결 시점의 "세션 확립" 판정 축을 다루고 boot 세대 비교를 명시적으로
   기각하는데, `1-widget-app.md` 어디에도 "boot 세대"를 판정 기준으로 쓰는 서술이 없어 되살릴 모순 대상이
   없다(오히려 §R7 의 "대안이 두 번 실패한 이력" 은 spec 밖 구현 이력 참조라 spec 텍스트 자체와 충돌할
   여지가 없다). §3.1 "새로고침/이동" 행·"토큰 만료/서버 타임아웃" 행은 모두 "재로드 상태 분기 SoT =
   `3-auth-session §3.1`" 로 위임돼 있어, §3.1(및 그 Rationale 인 §R8)이 세부를 정의해도 상위 문서와
   상충하지 않는다(정의상 위임 관계).
5. **권한·RBAC 모델 충돌** — 신설 서술은 익명 공개 위젯의 클라이언트측 토큰 취급 정책이라 워크스페이스
   RBAC(Admin+ 등)와 무관. 영향 없음.
6. **계층 책임 충돌** — `4-security.md §1` 신설 행은 코드 SoT 를 `loadSession(path, apiBase)`(위젯 SPA)로
   명시해, 같은 표의 다른 클라이언트측 방어 행(`apiBase` 쿼리 검증 — `use-widget.ts`)과 동일한 계층
   배치를 따른다. `4-security.md §2`(서버 CORS 헤더 정책)·`§3`(클라이언트 embed origin soft 검증)과는
   서로 다른 축(② 서버 origin 헤더 vs ③ 호스트 페이지 origin vs 신규: API 대상 origin/apiBase)이라
   중복·상충이 아니라 세 번째 독립 축의 신설이다 — 이미 §1 표의 "빈 목록 의미(레이어별)" 각주가 §2/§3
   레이어 차이를 명문화해 온 패턴과 정합적으로 확장된다.

## 요약

diff 는 이미 구현·병합된 `3-auth-session.md §3.1` apiBase 바인딩 정책(#1015, 이번 diff 밖)에 대한
Rationale 문서화(§R7·§R8)와 그 정책을 참조하는 짧은 교차 서술 2건(`4-security.md §1` 위협표 행,
`2-sdk.md §3` 예외 각주)이다. 실측 결과 `1-widget-app.md`·`2-sdk.md`·`5-system/14-external-interaction-api.md`
어디에도 §R8 의 "apiBase 변경 재부팅 → 세션 폐기·재시작" 주장과 직접 모순되는 서술이 없다 — `1-widget-app.md`
는 애초에 `wc:boot` 재전송을 서술하지 않도록 이미 SoT 가 분리돼 있었고(신규 갭 아님), EIA 토큰은 apiBase/origin
을 인코딩하지 않아 서버 계약과도 무관하다. `4-security.md §1` 신설 행은 §2(CORS)·§3(임베드 allowlist)와
겹치지 않는 세 번째 독립 축(발급 API origin에의 세션 바인딩)이다. 신규 상호 링크 3개는 파일 단위로는
모두 정확히 해소되며, fragment 앵커 부재는 이 문서군의 Rationale-간 참조 다수가 이미 쓰는 스타일과
일치해 회귀가 아니다. Critical/Warning 급 충돌은 발견되지 않았고, 발견된 두 건은 모두 INFO(완전성·스타일
권고)이며 액션은 선택적이다.

## 위험도

NONE

STATUS=success
