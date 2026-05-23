# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-presentation-normalize-button-ids.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### [INFO] ai-presentation-tools.md 의 §10.5 소유권과 중복 편집 가능성
- target 위치: target 문서 §변경 대상 표, `spec/4-nodes/6-presentation/0-common.md` §10.5
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §4.1 Spec 작성 (완료 체크박스 포함) 및 §4.3 백엔드 구현
- 상세: `ai-presentation-tools.md` 는 `spec/4-nodes/6-presentation/0-common.md` §10 신설을 포함해 §10.5 를 정의한 원 plan 이다. §10.5 의 현행 4-step 구성 (validate → 위반 회신 → 재시도 → 텍스트 fallback) 은 이미 그 plan 의 §4.1 Spec 작성 단계가 main 에 커밋된 결과물이며, worktree `ai-presentation-tools-9b7c5c` 는 현재 물리적으로 존재하지 않고 git worktree 목록에도 없다. 즉 active worktree 경합은 없다. 단, `ai-presentation-tools.md` 는 아직 `plan/in-progress/` 에 남아 있으며 `render-tool-provider.ts` 신설·dispatcher 분류 로직 등 구현 항목 다수가 미완이다. target plan 이 같은 spec 파일 §10.5 를 수정할 때, `ai-presentation-tools.md` 의 미완 구현 항목 중 `render-tool-provider.ts` 가 normalize 단계를 어떻게 구현해야 하는지에 대한 spec 의존성이 생긴다.
- 제안: target plan 의 "적용 후 후속" 절에 이미 "developer 가 `render-tool-provider.ts` 의 normalize 단계 구현" 을 명시하고 있으므로 `ai-presentation-tools.md` §4.3 의 해당 항목에 "normalize 단계 구현은 `spec-draft-presentation-normalize-button-ids.md` 적용 이후 진행" 메모를 추가해 두는 것이 권장된다. 필수 차단 사항은 아니다.

### [INFO] target plan 의 현행 §10.5 step 수 서술 오류
- target 위치: target 문서 §변경 대상 표 "변경" 셀: "기존 3-step (validate → 위반 회신 → 재시도)"
- 관련 plan: 없음 (spec 현행 텍스트와의 불일치)
- 상세: 실제 spec `spec/4-nodes/6-presentation/0-common.md` §10.5 의 현행 구성은 4-step (validate / 위반 회신 / 재시도·silent drop / 텍스트 fallback) 이다. target plan 이 "기존 3-step" 이라고 서술한 것은 step 4 (에러 포트 미발화) 를 별개 step 으로 보지 않은 것으로 보이나, draft 본문 자체는 5-step 으로 올바르게 재번호하고 있어 실제 변경 내용은 정확하다. plan 설명 텍스트의 서술 부정확 (3→4) 이며, spec 변경 내용 자체에는 영향 없다.
- 제안: target plan 의 §변경 대상 표 "변경" 셀을 "기존 4-step … 사이에" 로 수정하면 독자 혼선을 방지할 수 있다. 선택 사항이며 승인 차단 사유 아님.

### [INFO] defaults overlay / 1MB cap 순서가 §10.5 본문에 기재되지 않은 상태에서 참조됨
- target 위치: target 문서 draft §10.5 신규 step 3 본문: "validate 통과 + defaults overlay + 1MB cap 적용 이후"
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §4.3 dispatcher 분류 로직 (미완)
- 상세: 현행 spec §10.5 는 "defaults overlay" 와 "1MB cap" 을 step 항목으로 명시하지 않는다 (§10.4 캡 설명 + §10.3 주변 텍스트로 암묵 처리). 신규 step 3 본문은 이 두 단계를 전제로 "이후" 라고 서술하므로 독자가 §10.5 만 보면 overlay/cap 단계의 존재를 step 목록에서 확인할 수 없다. `ai-presentation-tools.md` §4.3 의 dispatcher 구현 명세 (`defaults overlay 적용`, `zod validate → 1MB cap`) 와는 의미적으로 정합하지만, spec 텍스트 수준의 설명 연결고리가 단락된다.
- 제안: 신규 step 3 앞에 "(2단계 통과 후, §10.3·§10.4 의 overlay·cap 처리 완료 시점)" 과 같은 in-line 괄호 cross-ref 를 추가하거나, §10.5 step 목록 서두에 "본 단계는 §10.3 defaults overlay → §10.4 1MB cap 이후 추가 후처리를 다룬다" 같은 한 줄을 추가하면 standalone 가독성이 향상된다. 선택 사항.

---

## 요약

target plan (`spec-draft-presentation-normalize-button-ids.md`) 은 `spec/4-nodes/6-presentation/0-common.md` §10.5 에 button.id 정규화 step 1행을 삽입하는 최소 범위 변경을 제안한다. 검토 결과, `ai-presentation-tools.md` 의 미완 구현 항목(`render-tool-provider.ts`)이 같은 파일의 §10 영역을 대상으로 하지만 active worktree 경합은 없으며 결정 사항 충돌도 없다. target 의 button.id normalize 결정은 사용자 명시 결정(2026-05-23 A+C 동시)에 기반하고, `ai-presentation-tools.md` 의 미결 결정과 교차하지 않는다. 선행 plan 미해소 조건도 없다 (§10 AI tool 모드 spec 은 main 에 이미 반영). 후속 영향으로는 `ai-presentation-tools.md` §4.3 구현 단계에서 normalize 로직을 `render-tool-provider.ts` 에 반영해야 한다는 의존성이 생기며, target plan 의 §적용 후 후속 절이 이를 이미 언급하고 있다. 전체적으로 plan 간 정합성 위협이 없는 상태이며, 발견된 사항은 모두 INFO 수준이다.

## 위험도

NONE
