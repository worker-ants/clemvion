# RESOLUTION — `19_25_39` (Critical 0 · WARNING 2 · RISK LOW)

## W1 (maintainability) — 반영 · **이 PR 의 주제를 이 PR 이 어겼다**

**지적**: `resolveTriggerParameters` 의 docblock 하나 안에서 기존 **영문** 설명 뒤에 신규
**한국어** 설명이 이어붙어 블록 내부에서 언어가 전환된다.

**아프고 정확한 지적이다.** 이 PR 의 네 항목 중 하나가 *"`workflows.controller.ts` 의 한/영
인라인 주석 혼재"* 를 고치는 것인데, **같은 PR 이 다른 파일의 docblock 에 언어 혼재를 새로
만들었다.**

**블록 전체를 한국어로 통일**했다(리뷰어가 준 두 선택지 중 후자). 앞 선택지(신규 단락을
별도 블록으로 분리)를 안 고른 이유: 한 함수에 docblock 은 하나뿐이라 "분리" 하면 결국
docblock 밖 주석이 되어 IDE hover 에서 사라진다 — 정보를 옮기는 게 아니라 **숨기는** 쪽이다.

항목 802 에 적용한 원칙(*"언어만 바꾸고 정보는 잃지 않는다"*)을 그대로 적용했다 — 영문
bullet 3개의 내용(기본값 채움 · 누락/coerce 실패 **전부** 수집 · 빈 스키마 pass-through)은
한 글자도 잃지 않았다.

> 실측: 그 docblock 의 **한글 없는 서술 줄 0건**(남은 2줄은 `{@link}` 태그와 spec 경로로
> 산문이 아니다).

## W2 (documentation) — 반영 안 함 · 트래커 등재

**지적**: `POST /workflows/:id/execute` 도 같은 마커 거부 규칙 대상인데 `parameterValues` 가
**인라인 타입 + `@ApiBody` 부재**라 OpenAPI 에 예약어 설명이 들어갈 자리가 없다. 이번 diff 가
`re-run` 쪽만 상세화해 **비대칭이 더 두드러졌다**.

리뷰어도 *"이번 PR 스코프 밖, 트래커에 기록 권장"* 으로 판정했다. **DTO 승격은 코스메틱이
아니라 컨트롤러 시그니처 변경**이라 이 PR 에 넣으면 코스메틱 PR 이 아니게 된다.

정본 트래커에 신규 항목으로 등재하고, **지금 고치지 않는 이유**와 **고칠 때 무엇을 이식할지**
(=`re-run.dto.ts` 의 설명)까지 적었다.

## INFO 18건 — 조치 안 함

전부 "없음"/"조치 불요"/긍정 확인이다. 값진 것 둘만 기록:

- **INFO 4·15 (requirement·testing)** — 리뷰어가 **독립적으로** `masked-reject-callers` 캐너리
  15/15 GREEN 을 확인했다. 내가 뮤테이션 2종으로 얻은 결론(가드가 무뎌지지 않았다)과 일치한다.
- **INFO 16 (testing)** — Swagger description 산문과 `MASKED_MARKERS` 상수의 동기화를 강제하는
  테스트가 없다. **이번 PR 이 만든 결함은 아니지만 이번 PR 이 그 표면을 하나 늘렸다.**
  마커를 바꾸는 PR 이 grep 체크리스트로 인지해야 한다 — 이미 신설 `egress-masking.md §3`
  (*"이 문서는 기계가 지키지 않는다"*)이 같은 클래스를 소유한다.
