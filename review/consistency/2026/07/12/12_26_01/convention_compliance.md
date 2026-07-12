# 정식 규약 준수 검토 — spec/7-channel-web-chat (--impl-done)

## 검토 범위 확정 (선행 작업)

prompt 의 `git diff origin/main` 기반 diff 는 **오염됨** — `origin/main`(7cc2f3218, PR #926)이 이 워크트리의
fork point(`84b1ea635`) 이후로 이미 앞서 있어(embed-config DTO rename 등 별건 병렬 PR 포함) 실제로는 origin/main
쪽 변경이 "삭제"로 역전 표시된다. `git merge-base HEAD origin/main` = `84b1ea635` 로 확인 후,
`git diff 84b1ea635 HEAD` 로 **실제 검토 대상 diff** 를 재확정했다:

```
codebase/channel-web-chat/src/app/demo/demo-config.ts | 2 +-
codebase/packages/web-chat-sdk/examples/snippet.html  | 2 +-
spec/7-channel-web-chat/2-sdk.md                      | 2 +-
```

= 커밋 `40a375972 fix(web-chat): 위젯 disclaimer 예시·데모 기본값 문구 해요체 통일 (i18n-userguide §P6)` 단독.
세 곳의 `disclaimer` 예시/기본값 문구를 `"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."` 로 통일(종전:
`...정확하지 않을 수 있습니다.`/`...추가 확인이 필요합니다.`/`... …`(생략) 세 가지 상이한 문구, 그중 둘은 합쇼체).

## 발견사항

이번 diff 자체에는 CRITICAL/WARNING 위반이 없다.

- **[INFO]** 해요체 통일 diff 는 `spec/conventions/i18n-userguide.md §Principle 6`(및 `_glossary.md` §1 "해요체로
  통일해요. `~합니다`/`~한다` 금지")를 정확히 겨냥한 준수 수정이다.
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 예시의 `disclaimer` 필드, 및 대응
    `codebase/channel-web-chat/src/app/demo/demo-config.ts` `defaultDemoForm.disclaimer`,
    `codebase/packages/web-chat-sdk/examples/snippet.html` 예시.
  - 근거 규약: `spec/conventions/i18n-userguide.md` §Principle 6 — "위젯의 인라인 한국어도 Principle 6(해요체·
    금지어)는 따른다"(dict indirection 만 P1/P2 면제, 문체는 위젯도 적용).
  - 상세: 변경 전 세 곳이 서로 다른 문구(`...습니다.` 합쇼체 2곳 + 말줄임 placeholder 1곳)였고, 변경 후 완전히
    동일한 해요체 문장으로 수렴했다. `_glossary.md §5` 금지어 목록과 대조해도 신규 문구에 저촉 항목 없음
    ("부정확할" 등은 금지어 아님).
  - 제안: 없음 (규약 그대로 준수).

- **[INFO]** 동일 파일 내 잔존 합쇼체 disclaimer 문자열 1건 — 이번 diff 스코프 밖, 낮은 실익.
  - target 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx:44`
    (`disclaimer: "AI는 한정된 데이터로 동작합니다."`).
  - 위반 규약: `spec/conventions/i18n-userguide.md §Principle 6` (형식상 UI 가시 한국어 문자열 대상).
  - 상세: 이번 커밋이 "예시·데모 기본값" 3곳(spec 예시 / 데모 기본값 / SDK 예시)만 겨냥해 완전히 통일했으나,
    같은 저장소에 위젯 렌더 테스트용 임의 fixture 문자열 1개가 여전히 합쇼체로 남아 있다. 다만 이 문자열은
    사용자에게 실제로 노출되는 문서/예시/기본값이 아니라 `<footer>` 렌더 여부만 검증하는 테스트 fixture 라
    Principle 6 적용 대상("사용자 가이드 본문·UI 사용자 가시 한국어 문자열")에 문자 그대로 해당하는지는
    경계선상이다 — 실사용자 화면·문서에 나타나지 않으므로 실질 영향 없음.
  - 제안: (선택) 문체 일관성을 완전히 맞추려면 같은 값으로 교체 가능하나, 테스트 의미에 영향 없는 순수
    스타일 변경이라 별도 후속으로 미뤄도 무방. 규약을 갱신할 필요는 없음(테스트 fixture 는 애초 스코프 밖으로
    보는 편이 합리적 — 다만 conventions 문서가 "테스트 fixture 제외" 를 명문화하고 있지는 않으므로, 반복
    지적을 피하려면 `i18n-userguide.md §적용 범위` 에 "테스트 fixture 문자열은 제외" 한 줄 carve-out 을
    명문화하는 편이 장기적으로 낫다).

## 별도 확인 — DTO 파일명 규약(오탐 방지 목적 기록)

`4-security.md` frontmatter `code:` 가 가리키는 `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
는 `spec/conventions/swagger.md §5-1`(`*-response.dto.ts` 패턴) 표기와 다르게 보일 수 있으나, 이는 **이번 진단
대상이 아니다** — 별도 병렬 세션이 `origin/main`(PR #926, 커밋 `7cc2f3218`)에서 이미
`embed-config.dto.ts → embed-config-response.dto.ts` 로 정정 완료했고(`plan/complete/embed-config-dto-rename.md`,
`consistency-check --impl-done BLOCK: NO` 확인 완료), 본 워크트리는 그 커밋을 아직 병합받지 않은 fork 상태일
뿐이다. 현재 워크트리 내부적으로는 코드 파일명과 spec frontmatter 가 서로 일치해 self-consistent 하므로 신규
위반으로 보고하지 않는다. (리베이스/머지 시 자동 해소됨.)

## 요약

이번 세션에서 실제로 검토해야 할 변경분(fork-point `84b1ea635` 대비)은 `disclaimer` 예시·기본값 문구를
해요체로 통일한 3-라인 diff 단독이며, `i18n-userguide.md §Principle 6`/`_glossary.md` 규약에 정확히 부합하는
준수 수정이다. CRITICAL·WARNING 위반은 발견되지 않았다. `spec/7-channel-web-chat/**` 전체 문서(0~5, 
`_product-overview.md`)도 함께 훑었으나 문서 구조(Overview/본문/Rationale 3섹션)·API 표면 표기(`{ data }`
wrapping, EIA 참조)·명명(파일·엔드포인트) 모두 conventions 와 정합했다. 유일한 잔여 지적은 위젯 렌더
unit test 안의 합쇼체 disclaimer fixture 1건으로, 사용자 비가시 영역이라 INFO 수준에 그친다.

## 위험도

NONE
