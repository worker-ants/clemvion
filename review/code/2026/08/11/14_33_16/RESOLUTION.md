# RESOLUTION — `14_33_16`

**Critical 0 / Warning 0.** 처분할 것이 없다.

## 이 라운드가 존재한 이유

CI `backend lint` 실패 → prettier 줄바꿈 2줄 fix → 그 fix 가 `codebase/**` 를 건드려 리뷰
게이트 재무장. 우회 수단이 없어 정규 라운드를 돌았다.

## 원인은 내 검증 갭이었다

이 PR 에서 `tsc --noEmit` 과 jest 는 돌렸는데 **backend eslint 를 한 번도 안 돌렸다**.
같은 세션의 다음 PR(#1146, frontend)에서는 `npx eslint` 를 매번 돌렸다 — **검증 절차를 자매
PR 사이에서 일관되게 적용하지 않았다.** 하필 이 PR 이 반복해 지적받은 "자매를 전수로 세지
않는다" 그 형태이고, 이번엔 그 대상이 코드가 아니라 **내 검증 절차**였다.

재발 방지로 이번엔 (a) 내가 건드린 backend 파일 5개 전수, (b) CI 와 동일한 전체 명령
둘 다 돌렸다.

## 리뷰어들이 확인한 것 — 델타가 사소해도 질문은 하나 있었다

**문자열 리터럴 안으로 줄바꿈이 들어가면 액션명이 바뀌어 spec 6곳과 어긋난다.** 넷이 각자
다른 방법으로 그 하나를 확인했다(바이트 대조 / 정규식 재추출 + 길이 / spec 정확 매칭 /
인접 줄 변형). `eslint --fix` 가 이 저장소에서 drive-by 를 주입한 전례가 있어 side_effect 가
그 축도 따로 봤다.

**documentation 은 커밋 메시지의 네 주장을 전부 재현했다** — 특히 `d7c6cf668^` 로 별도
워크트리를 떠서 전/후 lint 를 실행해 **47(1 error, 46 warnings) → 46(0 errors, 46 warnings)**
를 직접 비교했다. "CI 로그가 그렇게 말한다" 보다 강한 증거다.

## INFO — 기각한 대안 1건

**키 이름을 줄여 80자에 맞추자**(maintainability). 기각했다 — 이 파일의 장황함은 우연이
아니라 **sub-channel 을 액션명에 담는 의도적 설계**(`conventions/audit-actions.md §3`
Rationale, 폭발 반경이 다른 자격증명을 구분하기 위함)다. 키를 줄이면 그 근거와 정면
충돌한다. prettier 자동 분할을 수용하는 쪽이 맞다.

## 검증

- CI 와 동일 명령 `eslint "{src,apps,libs,test}/**/*.ts"` → **46 problems (0 errors)**.
- 트리거+감사 **172 passed**(불변), 내 모듈 타입 오류 0.
- scope: **"머지 가능, 다음 라운드 불필요"**.
