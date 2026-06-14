# 변경 범위(Scope) 리뷰

## 발견사항

### 발견사항 없음 (범위 내 변경)

모든 수정 사항이 plan/in-progress/spec-sync-discord-gaps.md 에 명시된 3개 항목(§3.1, §3.3, §5.1(b))의 범위 안에 있습니다.

---

**[INFO] 파일 1 — chat-channel.dispatcher.ts**
- 위치: diff +44~56 (`pendingFormModal` 블록)
- 상세: `modalFormConfig` 를 로컬 변수로 추출한 리팩토링 + `extractFormTitle` 호출 추가. 리팩토링은 중복 캐스팅 제거로 `extractFormFields` 인자와 `extractFormTitle` 인자가 동일 표현식을 공유하기 위한 최소 범위다. §3.3 title 전파를 위한 IIFE 패턴(`...(() => {...})()`)은 다소 비관용적이나 기능 범위는 벗어나지 않음.
- 제안: 이슈 없음.

**[INFO] 파일 2 — discord-message.renderer.spec.ts**
- 위치: diff +27~47 (신규 describe 블록)
- 상세: §5.1(b) reply 버튼 테스트를 기존 파일 맨 앞에 삽입. 기존 테스트는 한 줄도 변경되지 않았다. 신규 describe 가 §5.1(b) 구현 검증에 정확히 대응.
- 제안: 이슈 없음.

**[INFO] 파일 3 — discord.adapter.spec.ts**
- 위치: diff +67~68 (publicKey 단언), diff +266~341 (§3.3 신규 3개 it)
- 상세: 기존 `setupChannel` happy-path 테스트에 publicKey 단언 1줄 추가(§3.1). 신규 it 3개는 title 미지정/지정+truncate/minLength·maxLength 검증(§3.3). 기존 테스트는 수정 없음.
- 제안: 이슈 없음.

**[INFO] 파일 4 — discord.adapter.ts**
- 위치: diff +133~138 (`publicKey` spread), diff +307~340 (title/min_length/max_length)
- 상세: §3.1 publicKey 캐시, §3.3 title + 길이 제약. 두 수정 모두 plan 항목에 직접 대응. 기존 로직(slash command 등록, teardownChannel, sendMessage 등) 은 변경 없음.
- 제안: 이슈 없음.

**[INFO] 파일 5 — form-mode.spec.ts**
- 위치: diff +1 (import), diff +159~204 (신규 2개 it + 신규 describe)
- 상세: `extractFormTitle` import 추가와 그 테스트. 기존 extractFormFields describe 블록에 §3.3 validation 테스트 1개 추가, 그리고 `extractFormTitle` describe 신설. 기존 케이스 변경 없음.
- 제안: 이슈 없음.

**[INFO] 파일 6 — form-mode.ts**
- 위치: diff +83~46 (`validation` 블록 + `extractFormTitle` 함수 신설)
- 상세: `extractFormFields` 내 `validation.minLength/maxLength` 정규화 추가(§3.3), `extractFormTitle` 공개 함수 신설(§3.3). 기존 함수 시그니처·로직 변경 없음. `decideFormMode`, `validateFormSubmission` 은 untouched.
- 제안: 이슈 없음.

**[INFO] 파일 7 — types.ts**
- 위치: diff +52~26 (`botIdentity.publicKey`), diff +214~36 (`FormModalField.minLength/maxLength`), diff +236~44 (`OpenFormModalParams.title`), diff +560~54 (`pendingFormModal.title`)
- 상세: 공유 타입에 §3.1·§3.3 필드 추가. 모두 선택적(`?`) 필드라 기존 코드 호환 유지. `ChatChannelAdapter` 인터페이스·기타 타입 변경 없음.
- 제안: 이슈 없음.

**[INFO] 파일 8 — hooks.service.ts**
- 위치: diff +385~360 (`title` spread)
- 상세: `openFormModal` 호출 시 `state.pendingFormModal.title` 전달(§3.3). 3줄 추가, 나머지 로직 무변경.
- 제안: 이슈 없음.

**[INFO] 파일 9 — plan/in-progress/spec-sync-discord-gaps.md**
- 위치: 전체 미구현 항목 체크박스 갱신
- 상세: plan 문서의 체크박스·진척 narration 갱신은 CLAUDE.md `plan/` 쓰기 권한 절차에 부합. "보류" 섹션으로 이미지/embeds 항목 이동도 계획에서 의도된 범위 조정.
- 제안: 이슈 없음.

**[INFO] 파일 10 — spec/4-nodes/7-trigger/providers/discord.md**
- 위치: diff +54, +71, +126~141, +159~165, +191~
- 상세: "미구현 (Planned)" 표기 → 구현 완료 서술로 spec doc-sync. plan 문서의 narration과 일치. 코드 변경이 아닌 spec 갱신이며 plan 항목이 명시한 "spec doc-sync" 범위에 해당.
- 제안: 이슈 없음.

---

## 요약

총 10개 파일의 변경이 plan/in-progress/spec-sync-discord-gaps.md 에 기록된 §3.1(publicKey 캐시), §3.3(modal title 동적화 + TEXT_INPUT 길이 제약), §5.1(b)(reply 버튼 테스트 확인) 3개 항목과 1:1 대응한다. 불필요한 리팩토링, 관련 없는 기능 추가, 무관한 파일 수정, 포맷팅/주석/임포트 정리는 없다. dispatcher 에서 로컬 변수 추출은 코드 중복 제거를 위한 최소 범위 조정으로 scope 위반이 아니다. 이미지·embeds 항목은 공유 타입 의존으로 명시적 보류 처리되어 over-engineering 없이 적절히 경계가 설정됐다.

## 위험도

NONE

---

STATUS: SUCCESS
