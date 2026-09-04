# Rationale 연속성 검토 — `plan/in-progress/spec-draft-scope-and-anchor-drift.md`

## 발견사항

- **[WARNING]** ④ "코드를 전부 const 로 옮기지 않은 이유" 의 인용 출처가 실제로는 다른 문서다
  - target 위치: `plan/in-progress/spec-draft-scope-and-anchor-drift.md` §"④ 를 '코드를 전부
    const 로 옮기기' 로 하지 않은 이유" (target 파일 약 256~260행)
  - 과거 결정 출처(target 이 실제로 인용해야 했던 곳): `plan/complete/exec-intake-followups.md`
    ARCH#5 ④ (56행) — *"셋 다 **이미 타입 앵커가 있다.** 상수로 또 옮기면 앵커가 둘이 되어
    갈라진다."*
  - 상세: target 은 이 문장을 큰따옴표로 직접 인용하며 `spec-conventions-engine-error-code-surface.md`
    가 "이미 판단을 남겼다" 고 적었다. 그러나 `spec-conventions-engine-error-code-surface.md`
    본문을 전수 확인한 결과 그 문장(또는 그와 동의어 문장)이 **그 파일 안에는 없다** —
    이 문서는 §"함께 볼 것" 에서 `exec-intake-followups.md` ARCH#5 를 "착수 전 읽기" 로
    가리킬 뿐, ARCH#5 의 결론 자체를 옮겨 적지는 않았다. 실제 원문은
    `exec-intake-followups.md:56` 에 있다("셋 다 이미 타입 앵커가 있다. 상수로 또 옮기면
    앵커가 둘이 되어 갈라진다." — RESUME_CHECKPOINT_MISSING·RESUME_INCOMPATIBLE_STATE·
    INVALID_EXECUTION_STATE/ERROR_PORT_FALLBACK 세 카테고리에 대한 결론). 주장 자체는
    지어낸 것이 아니라 실재하는 과거 결정이지만(반증되지 않음), **인용 표시(따옴표)를 붙인
    출처가 틀렸다** — 다음 사람이 검증하려고 `spec-conventions-engine-error-code-surface.md`
    를 열면 그 문장을 찾지 못한다. `project_rationale_rejected_alternatives_need_history`
    교훈("기각된 대안은 실제 이력 필수, 지어내면 checker 가 잡는다")이 요구하는 것은 존재
    여부뿐 아니라 **정확한 소재**이기도 하다.
  - 제안: 인용문의 출처를 `spec-conventions-engine-error-code-surface.md` 대신
    `plan/complete/exec-intake-followups.md` ARCH#5 ④ 로 정정하거나, 두 문서를 함께 인용
    (`spec-conventions-engine-error-code-surface.md` §"함께 볼 것" 경유 → `exec-intake-followups.md`
    원문)한다. 인용 부호(`" "`)는 실제 원문과 문자 단위로 일치시킨다.

## 요약

target 의 네 항목(①§5.4 스코프 명시, ②`3-schedule.md` NULL 표시, ③§2.2 자원 액션 성문화,
④에러 코드 소속 표기) 은 모두 기존 spec 의 `## Rationale` 을 뒤집거나 기각된 대안을 재도입하는
것이 아니라, **번복이 필요한 자리마다 새 Rationale 를 함께 쓰는** 정상 패턴을 따른다. 특히 ③은
`3-execution.md` §Rationale(R-1.3) 의 "§2.2 단일 동사 action 패턴" 서술을 정면으로 수정하지만,
그 자리에서 33개 라우트 실측(9개가 하이픈 복합 동사구)으로 원 서술을 반증하고 "기각한 대안 —
'단일 동사' 로 성문화" 절을 명시적으로 남겨 원칙이다. ①은 §5.4(응답 형식 하위)의 암묵적 스코프를
명문화하는 것으로 기존 `EIA §5.3`/`nextCursor` 선례·swagger.md 의 참조 구조와 부합하며, 기존 원칙을
위반하지 않는다. ②는 구현이 이미 확정한 동작(`nextRunAt ? … : "-"`)을 문서로 뒤늦게 반영하는
것이라 결정 번복이 아니다. ④는 `spec-conventions-engine-error-code-surface.md` 가 남긴 후속 항목의
직접 집행이며, "코드를 const 로 통합하지 않는다" 는 기존 판단(§Rationale "삼분법"/"이미 앵커가
있다")을 그대로 존중한다 — 다만 그 판단을 뒷받침하는 인용문의 출처 문서를 잘못 짚었다(위 발견사항).
이 오귀속은 결정 자체를 무효화하지 않고, 검증 가능성만 떨어뜨리는 문서 정확성 문제다.

## 위험도

LOW
