# 보안(Security) Review

## 검토 범위 메모

이번 payload 는 39개 파일로 구성되어 있으나, 오케스트레이터가 사전에 확인한 대로 **직전 라운드
(`review/code/2026/08/10/13_21_24/`) 대비 이번 라운드의 실질 delta 는 두 곳뿐이다**:

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` JSDoc 블록 내
  자기모순 텍스트 2줄 정정("이중 스트림은 **호출부의 짝 가드**가 막는다" → "이중 스트림은
  **`openStream` 진입 가드**가 막는다", 게이트 457·463). 커밋 `edebb1cc1`.
- `plan/in-progress/webchat-reload-rest-error-branches.md` — provenance 문단 재작성("그 PR 범위
  밖" 이라 썼다가 정정) + "미구현 항목" 절 프레이밍 정정("결정 필요" → "developer 트랙, 결정은
  이미 내려짐"). 같은 커밋 `edebb1cc1` + 이후 문서 정정.

두 변경 모두 **주석/문서 텍스트만** 바뀌었고 실행 코드(조건문·반환값·호출 순서)는 한 글자도
바뀌지 않았다 — `git show edebb1cc1 -- codebase/channel-web-chat/src/widget/use-widget.ts` 로
직접 대조해 확인. 나머지 37개 파일은 이미 이전 라운드(`12_39_25`, `13_21_24`)에서 보안 NONE 으로
판정된 `use-widget.ts`/`use-widget.test.ts` 의 실질 리팩터(스트림 소유권 게이트 이동 + `boolean`
→ `StreamClaim` union 승격), 또는 그 자체가 실행되지 않는 `review/**` 산출물·`plan/**` 문서·
`spec/7-channel-web-chat/3-auth-session.md` frontmatter/캐비엇 정정(REST 오류 분기 미구현을
정직하게 반영)이며, 이번 라운드에서 재차 직접 대조했으나 새로운 보안 관련 코드 변경은
없었다.

## 발견사항

리뷰 대상 delta 범위 내에서 **CRITICAL/WARNING/INFO 급 보안 관련 발견사항이 없다.** 순수
텍스트 정정이므로 인젝션·인증/인가·입력 검증·암호화·에러 처리·의존성 표면 자체가 변경되지
않았다.

- **[INFO]** JSDoc 문구 정정이 서술하는 실제 코드 동작(스트림 소유권 게이트가 `openStream`
  진입에서 강제됨)은 이전 라운드에서 이미 보안 관점 검증 완료 — 이번엔 그 서술을 코드와
  일치시켰을 뿐
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:457`, `:463`
  - 상세: 정정 전 텍스트는 "이중 스트림은 호출부의 짝 가드가 막는다" 로, 이미 `ce6c81838`
    커밋에서 게이트가 `openStream` 내부로 이동한 뒤에도 남아 있던 옛 아키텍처 서술이었다(같은
    JSDoc 블록의 다른 문장 `:461-462`, `:466-468` 과 정면 충돌). 이번 정정은 그 잔재 문구를
    실제 구조("openStream 진입 가드")에 맞춰 고쳤을 뿐, 소유권 재확인 로직·검사 순서
    (`!client` → `streamRef.current !== null` → `closeStream()`, 중간 `await` 없음)·
    fail-closed 부정 비교 관용구는 전혀 건드리지 않았다. 이 로직 자체는 `13_21_24` 라운드
    보안 리뷰(`review/code/2026/08/10/13_21_24/security.md`)에서 NONE 으로 이미 검증됨.
  - 제안: 조치 불필요.
- **[INFO]** plan 문서(`webchat-reload-rest-error-branches.md`) provenance/프레이밍 재작성은
  서술 정정일 뿐, 그 문서가 추적하는 REST 오류 분기(`404`·복구불가 `401`·`401→낙관적 refresh`)
  구현 자체는 이번 라운드에서도 여전히 미착수(체크리스트 전부 `[ ]`) — 신규 보안 표면 없음
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md` (전체)
  - 상세: 문서가 스스로 밝히듯 `seedWaitingFromStatus` 의 `catch` 는 여전히 상태코드 구분 없이
    soft-fail 후 SSE 로 진행한다(코드 변경 없음). 이 갭은 "만료 vs blacklist 세션을 구분 못해
    streaming 상태에 계속 머무는" 가용성 성격이며 인증 우회·권한 상승 경로가 아니라는 이전
    라운드 판단이 그대로 유지된다. 실제 세 분기(404/401/낙관적 refresh)가 구현될 때는 refresh
    토큰 흐름·blacklist 판별 로직이 새로 생기므로 그 시점에 별도 보안 리뷰가 필요하다는 점만
    참고로 남긴다(이번 라운드의 조치 대상 아님).
  - 제안: 조치 불필요. 해당 plan 이 실제 구현으로 전환될 때 재검토 권장(이미 문서 자체가
    "착수 시 원 서술과 어긋나는 점이 발견되면 planner 턴으로 되돌린다" 고 명시).

## 점검 관점별 요약

1. **인젝션**: 해당 없음 — 코드 로직 변경 없음.
2. **하드코딩된 시크릿**: 없음 — 텍스트 diff 전수 확인, 토큰/키/자격증명 리터럴 없음.
3. **인증/인가**: 변경 없음 — 이번 delta 는 주석/문서뿐이고, 그 주석이 서술하는 SSE 스트림
   소유권 게이트 로직 자체는 이전 라운드에 이미 검증된 상태 그대로다.
4. **입력 검증**: 해당 없음.
5. **OWASP Top 10**: 해당 없음.
6. **암호화**: 해당 없음.
7. **에러 처리**: 해당 없음 — `catch` soft-fail 동작(에러 메시지 노출 여부 포함)은 변경되지
   않았고, 이는 `plan/in-progress/webchat-reload-rest-error-branches.md` 가 명시적으로
   추적 중인 기존 갭이다(이번 delta 의 조치 대상 아님).
8. **의존성 보안**: 신규 의존성 없음.

## 요약

이번 라운드의 실질 delta 는 `use-widget.ts` JSDoc 텍스트 2줄 정정과 plan 문서의 서술(provenance·
프레이밍) 정정뿐이며, 둘 다 실행 코드를 바꾸지 않는다. 그 텍스트가 서술하는 실제 로직(스트림
소유권 게이트의 `openStream` 진입 강제, fail-closed 부정 비교)은 이전 두 라운드
(`12_39_25`, `13_21_24`)에서 이미 보안 관점 NONE 으로 확인됐고 이번에도 변경되지 않았음을 직접
`git show`/`Read` 로 재확인했다. 새로운 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화·
민감정보 노출 위험은 발견되지 않았다.

## 위험도

NONE
