# RESOLUTION — 02_44_56

리뷰 대상: web-chat console follow-up 13건 (증분 3)
처리 일시: 2026-06-24

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드·문서 (USER_GUIDE_SYNC) | `3c8ab01b` | web-chat.mdx/en.mdx §3 "서버 미저장" 문장 → 서버 영속화 설명 교체; 저장 버튼·미저장 안내; Tips "저장 후 재복사" 갱신. KO/EN parity 준수 |
| #2 | 코드 (SIDE_EFFECT/JSDoc) | `3c8ab01b` | `useUpdateWebChatAppearance` JSDoc — enabled=true 인스턴스 전용 제약 + tokenStrategy 폴백(`"per_execution"`) 명기 |
| #3 | 코드 (SIDE_EFFECT/spec) | `3c8ab01b` | `spec/5-system/14-external-interaction-api.md §4` — `interaction` 객체 통째 교체(merge 아님) + `appearance` 미전달 시 silent deletion 경고 주석 추가 |
| #4 | 코드 (TESTING) | `08d560e1` | `trigger-dto-validation.spec.ts` — `WebChatAppearanceDto` 검증 (primaryColor 패턴·#RRGGBB/단축/rgba 실패, headerTitle MaxLength 80/81, locale IsIn ko/en/fr, position IsIn bottom-right/bottom-left/top-right) |
| #5 | 코드 (TESTING) | `08d560e1` | `trigger-dto-validation.spec.ts` — `QueryTriggerDto.interactionEnabled` Transform 경계 ('true'→true, 'false'→false, '1'→false, undefined→undefined, validate 통과) |
| #6 | 코드 (TESTING) | `08d560e1` | `use-web-chat.test.ts` 신규 — `useUpdateWebChatAppearance` PATCH body(enabled/tokenStrategy/appearance 포함), per_trigger 전달, 폴백 per_execution, invalidate 검증, 실패 reject |
| #7 | 코드 (TESTING) | `08d560e1` | `web-chat-page.test.tsx` — 저장 버튼 isDirty=false→disabled, 저장 성공 toast.success, 실패 toast.error |
| #8 | spec (SPEC-DRIFT) | `3c8ab01b` | `spec/7-channel-web-chat/2-sdk.md §3` — wc:resize 표에 hidden/blocked 시 `{width:0,height:0,state:'collapsed'}` emit 항목 추가 (코드 무수정) |
| #9 | spec (SPEC-DRIFT) | `3c8ab01b` | `spec/7-channel-web-chat/5-admin-console.md §6` — iframe 높이 clamp [320,640]px + width=컨테이너 100% 고정 한 줄 추가 (코드 무수정) |

## TEST 결과

- lint  : 통과 (backend prettier 기존 에러 포함 auto-fix, frontend 0 errors)
- unit  : 통과 (40 passed)
- e2e   : 통과 (214/214)

## 보류·후속 항목

- INFO #1 (SECURITY — WebChatAppearanceDto HTML sanitize 부재): 현행 수용. React escape·sanitizeDraft·JSON.stringify 다층 완화로 실 XSS 경로 제한적
- INFO #2 (SECURITY — live-preview wc:resize width 미반영): 현행 수용
- INFO #3 (SECURITY — allow-same-origin 트레이드오프): `3c8ab01b` 에서 `spec/7-channel-web-chat/4-security.md §1` 설명 추가로 흡수
- INFO #4 (mockConsole 클로저 배열 변이): 백로그
- INFO #5 (sendResize 빈 deps): 백로그
- INFO #6 (TRIGGERS_KEY 전체 무효화): 백로그 검토
- INFO #7~#10 (MAINTAINABILITY): 백로그
- INFO #11~#13 (TESTING): 백로그
- INFO #14 (API_CONTRACT — tokenStrategy 폴백): JSDoc 언급으로 부분 흡수 (W2 처리)
- INFO #15 (DOCUMENTATION — tokenStrategy JSDoc): W2 처리에서 함께 흡수
- INFO #16 (SCOPE): 분류 명확, 조치 불요
