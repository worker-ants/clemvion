# RESOLUTION — 로더 iframe 코너 고정

> 리뷰 세션: `review/code/2026/06/26/08_17_09` (대상 `82e97d2`). fix amend → `14722c8e`(author-date 보존 → 리뷰 세션 postdate, review_guard 유효). 처분: main(developer). Critical 0 + WARNING 2(FIXED).

## 검증 게이트
- lint PASS / web-chat-sdk jest **47 pass**(+2: zIndex:0, bottom-right 명시) / build PASS.

## WARNING — FIXED
- W1 `zIndex:0` 경계: `it("zIndex:0 은 falsy 지만 유효값 — DEFAULT 폴백 아님")` 추가 → `??` 가 0 통과 보증.
- W2 `position:"bottom-right"` 명시: 명시 전달 시 right:0/left 미설정 테스트 추가.

## INFO — FIXED
- I-1 (SPEC-DRIFT §3): `spec/7-channel-web-chat/2-sdk.md §3` 에 "host iframe 코너 고정(필수)" 문단 추가 —
  `position:fixed; bottom:0; left/right:0; z-index: appearance.zIndex ?? 2147483000` 명시 + 오프셋 누락 시 화면 밖 박힘 경고.
- I-2: `DEFAULT_Z_INDEX` JSDoc "§3 예시값"→"§1 스니펫 예시값" 정정.
- I-3: `WidgetBridge` 클래스 JSDoc 추가.
- I-4/I-7: `DEFAULT_Z_INDEX` export → `bridge.spec`·`index.spec` 가 import(리터럴 `"2147483000"` 중복 제거).
- I-6: position else 분기 주석 — "bottom-left 외 모든 값(미지정·미지원 포함) → 기본 bottom-right anchor(항상 코너 고정 보장)" 명시. (unknown 값에 side 미설정 시 재발하므로 안전 기본 유지가 옳아 else 유지.)

## 비이슈 / DEFER
- **security 출력 미생성**: 본 변경은 iframe 인라인 CSS(bottom/left/right/z-index) 설정뿐 — 사용자 입력 없음(position=고정 enum, zIndex=number→String()), **보안 표면 없음**. 재무장 루프 회피 위해 단독 재실행 안 함(다른 reviewer NONE).
- I-8(z-index 근거 주석)·I-9(zIndex 음수 검증, spec 범위 제약 부재)·I-10(index.spec non-null assertion, 기존 스타일): 경미/후속.
- I-5(plan 이동): 본 PR 최종 커밋에서 `plan/complete/` git mv + `spec_impact` 선언.

## 배포 주의
머지 후 운영 이미지 **재빌드·재배포** 시 적용(운영이 빌드된 loader.js 서빙). 고객 사이트의 기존 서드파티 오류(riend.js CORS/optimizer.php 502)는 우리 위젯과 무관.

## 종합
Critical 0, WARNING 2(FIXED). host iframe 코너 고정(spec §3 구현) + 테스트·spec·doc 보강. 머지 가능.
