# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 build guard 테스트가 `plan/complete/**` 전체를 재귀 스캔하도록 스코프를 확장
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:61` (`collectCompletedPlans` 함수 전체)
  - 상세: 기존 `plan-frontmatter.test.ts`는 `plan/in-progress/*.md`(top-level)만 읽었으나, 이번 변경으로 `plan/complete/` 하위 전체(archive 제외)를 재귀 `readdirSync`+`readFileSync`로 순회한다. 부작용 관점에서 문제되는 "쓰기"나 "예상 밖 상태 변경"은 아니다 — 순수 read-only 순회이고, 파일시스템에 아무것도 쓰지 않으며 exported 값도 없다. 다만 CI 테스트 스위트의 I/O 범위가 넓어져 실행 시간에 약간 영향을 줄 수 있다는 점만 기록한다(의도된 변경이며 PR 목적 자체가 이 스캔 신설).
  - 제안: 조치 불필요. 정보성 기록.

- **[INFO]** 26개 대상 파일 중 24개가 `plan/**` frontmatter의 `status: in-progress → complete` 필드 변경 + 상대링크 경로 정정(`spec-draft-node-cancellation-chat-channel-correction.md` 등, `plan/in-progress/*.md` 여러 곳에서 `../complete/<name>` 로 정정)이다.
  - 위치: 각 `plan/complete/*.md`·`plan/in-progress/*.md` 파일들 (예: `plan/complete/activity-disconnected-banner.md:4`, `plan/complete/audit-residual-triage.md:6` 등)
  - 상세: 이 변경들은 이번 PR의 핵심 목적(plan lifecycle 정합화)이 의도한 결과이며, 프로덕션 코드·공개 API·전역 상태·환경변수·네트워크 호출과는 무관하다. `git mv` 없이 `plan/in-progress/spec-draft-secret-store-verification-footnote.md` 를 삭제하고 `plan/complete/spec-draft-secret-store-verification-footnote.md` 를 신규 추가하는 형태(파일 15·23)로 나타나지만, diff 내용을 대조하면 frontmatter(`status`) 갱신 외 본문은 그대로 이관된 것으로 실질적 "예상치 못한 파일시스템 변경"은 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 시그니처·인터페이스 변경 없음
  - 위치: N/A
  - 상세: 26개 파일 중 실행 코드(TypeScript)가 변경된 곳은 `plan-frontmatter.test.ts` 하나뿐이며, 그마저 새 내부 함수(`collectCompletedPlans`, `relativeLinkTargets`) 추가와 새 `describe`/`it` 블록 추가뿐이다. 기존 `collectTopLevelPlans` 등 기존 함수 시그니처는 변경되지 않았고, 이 파일은 테스트 전용(`__tests__/`)이라 외부에서 import 되는 공개 API가 아니다. 프로덕션 백엔드/프론트엔드 소스 파일은 이번 diff에 전혀 포함되지 않았다.
  - 제안: 조치 불필요.

## 요약

이번 변경 세트는 26개 파일 중 1개(`.claude/docs/plan-lifecycle.md`, 문서), 1개(`plan-frontmatter.test.ts`, 신규 read-only build-guard 테스트), 24개(`plan/**` frontmatter `status` 필드 갱신 + 상대링크 경로 정정)로 구성되며, 프로덕션 코드·전역 변수·파일시스템 쓰기(테스트 대상 이관 자체는 PR의 의도된 목적)·함수 시그니처·공개 API·환경변수·네트워크 호출·이벤트/콜백 어느 축에서도 의도치 않은 부작용은 발견되지 않았다. 신규 테스트는 `fs.readdirSync`/`fs.readFileSync`만 사용하는 순수 read-only 검증 로직이며 쓰기 동작이 전혀 없다.

## 위험도

NONE
