# 문서화(Documentation) 리뷰 — `impl-chat-channel-patch-token` (재검토, 23_55_23)

## 개요

본 리뷰 대상 diff 에는 (1) 실제 애플리케이션 코드/테스트 7개 파일(`ChatChannelUpdateConfigDto` 신설,
`setupChatChannel` secret 쓰기 게이팅, 관련 서비스/DTO/e2e 변경)과 (2) `plan/in-progress/impl-chat-channel-patch-token.md`,
그리고 (3) 같은 세션에서 이미 커밋된 이전 코드 리뷰(`review/code/2026/09/10/23_21_57/**`)·
consistency-check(`review/consistency/2026/09/10/{21_37_56,22_45_26}/**`) 산출물 다수가 함께 포함돼 있다.
(2)(3)은 이전 라운드가 이미 스스로 검토·수렴한 프로세스 산출물이라, 이번 문서화 리뷰는 그 판정을
재검토하지 않고 **그 라운드가 지적한 문서 결함이 실제로 고쳐졌는지**를 현재 소스를 직접 열어
실측하는 데 집중했다.

## 이전 라운드(`23_21_57/documentation.md`) 지적 3건 — 전부 수정 확인됨

`git log`로 확인한 해소 커밋은 `771801fca`(`/ai-review` `23_21_57` 조치, `RESOLUTION.md` 기재)다.
세 건 모두 현재 소스를 직접 `Read`하여 개별 확인했다 — 재발 없음.

1. **`assertChatChannelInputSafe` JSDoc 이 `mode` 분기 미반영 (WARNING)** → 수정 확인.
   `codebase/backend/src/modules/triggers/triggers.service.ts` 함수 `assertChatChannelInputSafe`
   JSDoc 끝에 "**`mode === 'update'` 에서는 위 provider 분기가 적용되지 않는다** … 즉 위 'slack: 필수 /
   discord: 필수' 서술의 주어는 **생성(POST) 한정**이다." 문단이 추가돼 있다 (함수 시그니처 직전,
   `mode: ChatChannelInputMode` 매개변수 바로 위 문단).
2. **에러 메시지 해요체/합쇼체 혼용 (INFO)** → 수정 확인.
   `assertChatChannelAlreadySetUp` 내부 메시지가 `'…에서만 할 수 있어요. PATCH 는 bot token 을 받지
   않으므로 채널을 새로 붙일 수 없어요.'` 로 두 문장 모두 해요체로 통일됐다(형제 메시지 `botToken`/
   `inboundSigningPlaintext` 거부 메시지와도 톤 일치).
3. **plan D-2 표의 코드 줄 번호 인용이 stale (INFO)** → 수정 확인.
   `plan/in-progress/impl-chat-channel-patch-token.md` `## 설계` 절 D-2 표가 `:948-952` 등 줄 번호
   대신 `` `// [쓰기 ①]` ``/`` `// [쓰기 ②]` ``/`` `// [쓰기 ③]` `` 앵커 표기로 바뀌었고, 실제 코드
   (`triggers.service.ts`)에도 동일 앵커 주석 3개가 존재해(`grep -n "쓰기 ①\|쓰기 ②\|쓰기 ③"`) 서로
   대응한다. (`## 착수 전 실측` 표의 `:948-952` 인용은 "착수 **전**" 시점 서술이라 원래도 문제 아님 —
   그대로 남아 있다.)

## 발견사항 (이번 라운드 — 신규)

- **[INFO]** (비차단, 이미 추적 중 — 참고용 재확인) `spec/5-system/15-chat-channel.md` §5.4.1 의
  `details.field` placeholder 가 "**미확정 — 후속 e2e 확인 대기**" 로 남아 있는데, 이번 diff 의
  `trigger-dto-validation.spec.ts` `[실측]` 테스트가 이미 그 값을 실측 확정했다(5필드 전부
  `chatChannel.<field>` 중첩 경로).
  - 위치: spec 쪽 `spec/5-system/15-chat-channel.md:375` (`details.field` 는 **미확정 — 후속 e2e
    확인 대기**); 실측 테스트는 `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
    함수 `it('[실측] 차단 5필드의 details.field 는 전부 중첩 경로다', …)`.
  - 상세: 새로 발견한 결함이 아니다 — `plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에
    실측해 planner 로 넘길 것" 표, `review/code/2026/09/10/23_21_57/api_contract.md` INFO#4,
    `review/consistency/2026/09/10/22_45_26/SUMMARY.md` 참고(INFO#3) 세 군데가 이미 동일 갭을
    포착했고 전부 "developer 권한 밖(`spec/` 정정) → planner 후속" 으로 일관되게 처분해 뒀다. 세
    산출물의 처분이 서로 어긋나지 않는지만 교차 확인했고 어긋남 없음.
  - 제안: 별도 조치 불필요 — planner 턴에서 §5.4.1/§5.4.1.1 placeholder 를 이번 실측값으로 확정하면
    닫힌다. 이 리뷰가 새로 요구하는 것은 없음.

- 그 외 신규 CRITICAL/WARNING 급 문서화 결함은 발견하지 못했다. `setupChatChannel`(3-쓰기 표),
  `ChatChannelUpdateConfigDto`(OmitType 근거), `assertPatchCarriesNoSecrets`/
  `assertChatChannelAlreadySetUp`(신규 private 메서드) 의 JSDoc 은 모두 현재 코드 동작과 정확히
  일치함을 라인 단위로 대조했다. 컨트롤러 `@ApiBadRequestResponse` 의 3가지 신규 400 사유 서술
  (`details.field="chatChannel.botToken"` 등)도 실제 구현 응답 경로(전역 `CustomValidationPipe` 의
  중첩 경로 — 서비스 층 `assertPatchCarriesNoSecrets` 의 flat 경로는 HTTP 로는 도달하지 않음)와
  일치함을 확인했다. `TODO`/`FIXME`/`XXX` 잔존 없음(전수 grep).

## 확인한 것 — 문제 없음

- `update-trigger.dto.ts` 의 `chatChannel` 필드 위에 JSDoc 블록 두 개가 연속으로 쌓여 있는 형태
  (기존 "부분 갱신 — 전체 객체 다시 send" + 신규 "생성용과 다른 DTO 다…")를 tsc 로 직접 컴파일해
  선행 comment trivia 손실 여부를 실측했다 — `--declaration` 산출물에 두 블록이 모두 그대로
  보존됨을 확인, 정보 손실 없음.
- README: `codebase/backend/README.md` 재확인 — `chatChannel`/`botToken` 언급 없음, 갱신 불필요.
  신규 마이그레이션 파일 없음, 신규 환경변수 없음.
- CHANGELOG: 이 저장소는 별도 CHANGELOG 파일이 없고 spec 문서의 `## Rationale`(R-CC-21)을
  변경 이력으로 쓰는 관례이며, 그 spec 정정은 developer 권한 밖이라 planner 후속으로 올바르게
  넘겨져 있다(위 참고 항목과 동일 트래킹).

## 요약

이전 fan-out 라운드(`23_21_57`)가 지적한 문서화 결함 3건(JSDoc `mode` 분기 누락·에러 메시지 어투
혼용·plan 표 stale 줄 번호)은 모두 커밋 `771801fca`로 실제 수정됐음을 현재 소스를 직접 읽어
확인했다. 이번 재검토에서 새로 발견한 CRITICAL/WARNING 급 문서 결함은 없다. 유일한 잔여 항목
(spec `details.field` placeholder 가 이번 PR 의 실측값으로 아직 갱신되지 않음)은 developer 권한
밖의 spec 정정이라 이미 plan·api_contract 리뷰·consistency-check 세 경로 모두에서 일관되게
planner 후속으로 처분돼 있어 이 PR 을 막을 사유가 아니다. 핵심 신규 코드의 JSDoc/인라인 주석은
설계 근거·spec 앵커·회귀 캐너리 참조를 갖춰 이 저장소 평균 대비 높은 수준을 유지하고 있다.

## 위험도

NONE
