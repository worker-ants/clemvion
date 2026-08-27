# 유지보수성(Maintainability) 코드 리뷰 — masking-residuals-0b195b (3라운드, `12_00_05`)

## 검토 범위와 방법

핵심 코드 4개 파일(`mask-sensitive-fields.util.{ts,spec.ts}`, `handler-output.adapter.{ts,spec.ts}`)과 인접 파일(`ai-turn-executor.ts` 주석)을 `Read`로 현재 소스 그대로 전문 대조했다. 이 변경은 이미 두 차례(`10_53_52`, `11_25_15`) 유지보수성/문서 리뷰를 거쳤고, 그때 지적된 사항(체크리스트 drift, "18 passed" 오기, 4곳 stale 인용) 대부분이 이후 커밋(`fa6e2294c`, `23e1c91a0`)에서 실제로 해소된 것을 `git log`/`git show`로 직접 확인했다. 아래는 **아직 남아 있는 것**과 **새로 확인한 것**만 보고한다. `plan/**`·`review/**`·`spec/**` 43개 파일은 프로세스·문서 산출물이라 "코드"로서의 함수 길이/복잡도 평가 대상이 아니므로 최소 확인만 했다.

## 발견사항

- **[WARNING]** 두 차례 지적된 "끊어진 문장"이 재수정 시도 후에도 여전히 문법이 깨져 있다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:30-36` (Read로 확인한 실제 줄 번호. 특히 32행 "이 상수는 **소비처는 이제 `explore-tools.service.ts`(workflow-assistant) 하나다.**"와 36행 "// 내보낸다 — 비-자격증명 config 필드가 이 이름들과 겹치면 멀쩡한 값이 가려진다.")
  - 상세: 이 문제는 `10_53_52` requirement.md(INFO)와 `11_25_15` documentation.md(INFO)가 각각 지적했고, 후속 커밋 `23e1c91a0`이 "W1~W4 전부 처리"를 표방하며 이 파일에도 손을 댔다(`git show 23e1c91a0` 확인). 그런데 그 편집은 "**소비처는 이제 `explore-tools.service.ts` 하나다.**" 문장을 취소선 앞에 끼워 넣었을 뿐, 원래 문장의 뒷부분("내보낸다 — 비-자격증명 config 필드가 …")은 그대로 남겨 두었다. 그 결과 지금 이어 읽으면 "이 상수는 소비처는 이제 …하나다. (취소선) …표현식은 원문을 읽는다. **내보낸다** — 비-자격증명 config 필드가 …" 로 이어져 주어 없는 동사("내보낸다")가 계속 붕 떠 있다. 즉 **같은 PR 안에서 "고쳤다"고 표방한 지점이 실제로는 안 고쳐진 채 남았다** — 이 세션 자신이 반복 겪어 온 "미러 스윕이 몇 곳을 놓친다" 클래스의 재발이다. 이 상수(`DEFAULT_SENSITIVE_KEYS`)는 이 PR의 안전 서사가 걸린 자리이므로, 그 설명 주석이 문법적으로 신뢰하기 어려운 상태로 남는 것은 단순 오타 이상의 비용이다.
  - 제안: 원래 문장 전체("이 상수는 `handler-output.adapter.ts` 도 쓰고 … 내보낸다 — 비-자격증명 config 필드가 이 이름들과 겹치면 멀쩡한 값이 가려진다.")를 통째로 취소선 처리하거나, 새 문장 뒤에 남는 절을 유일한 잔존 소비처(`explore-tools.service.ts`)를 명시적 주어로 삼아 재작성한다(예: "그 유일한 잔존 소비처가 config 를 그대로 내보낸다 — 비-자격증명 필드가 …").

- **[INFO]** 동일한 보안 불변식 설명이 여전히 3곳에 근접-중복 서술됨
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-52`(인라인 주석), `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:92-108`(JSDoc), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:116-137`(JSDoc)
  - 상세: "어댑터가 config 를 더 이상 마스킹하지 않아도 안전한 이유(egress 두 곳이 이미 `deepRedactSecrets*`를 걸고, 그 키 축이 `DEFAULT_SENSITIVE_KEYS`를 포함한다) + 초판 캐너리가 실제로는 파생이 아니었다는 반증 이력"이라는 동일 논지가 세 파일에 표현만 바꿔 반복된다. `10_53_52` maintainability.md가 이미 이 항목을 INFO로 지적했고 이번 라운드까지 그대로 남았다(구조 변경 없음). 이 저장소가 스스로 겪었듯 다중 산개 서술은 향후 이 불변식이 바뀔 때 한 곳만 고치고 나머지를 놓치는 사고를 유발하기 쉬운 형태다.
  - 제안: 셋 중 한 곳(예: `mask-sensitive-fields.util.spec.ts`의 포함관계 캐너리 JSDoc)을 canonical 설명으로 삼고, 나머지 두 곳은 "왜 안전한지는 X 파일 참조"로 축약해 동기화 비용을 낮춘다. 다만 이 PR이 이미 6개 spec + 다수 주석을 건드렸으므로 이번 PR에서 강제할 사안은 아니다.

- **[INFO]** 한 줄 코드에 23줄 인라인 주석이 붙어 코드-주석 비율이 극단적이다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-53` (`config: r.config ?? {},` 한 줄에 앞선 주석 23줄)
  - 상세: 이 저장소가 보안 결정에 상세한 rationale 주석을 남기는 관례 자체는 일관되고 바람직하지만, 이 정도 분량(전체 함수 34줄 중 23줄이 이 한 프로퍼티의 주석)은 `adaptHandlerReturn` 함수 본문의 실제 로직(객체 리터럴 조립)을 시각적으로 가린다. 기능적 결함은 아니다.
  - 제안: 핵심 "왜 안전한가" 1~2문단만 남기고, 반증 이력(초판 캐너리 오류·`10_53_52` 경위)은 CHANGELOG/spec 정정 블록으로의 짧은 포인터로 대체하는 것을 고려. 강제 아님.

- **[INFO]** 인접 절이 같은 주어를 반복해 약간 장황하다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3279-3280`
  - 상세: "credential (llmConfigId 가 가리키는 provider secret) 은 포함하지 않으며 credential 은 **allow-list 로 애초에 배제**한다" — 두 절이 사실상 같은 내용("포함 안 함" / "배제함")을 "credential"을 주어로 반복한다. 가독성에 미미한 영향, 기능 무관.
  - 제안: "credential (llmConfigId 가 가리키는 provider secret) 은 **allow-list 로 애초에 배제**한다 — 아래 `_resumeState` 와 같은 정책." 한 문장으로 통합. 사소하여 강제하지 않음.

## 긍정적으로 확인된 점

- `plan/in-progress/masking-expression-egress-split.md` 체크리스트는 `/ai-review` 한 줄만 미체크로 남기고 전 항목이 실제 diff 상태와 정확히 일치한다 — 이전 라운드가 지적한 체크박스 drift가 완전히 해소됨을 확인.
- 이전 라운드가 지적한 "18 passed" 오기는 "측정하지 않고 측정했다고 적었다"는 정정 문구와 함께 실제 수치로 바로잡혔다(`plan/.../masking-expression-egress-split.md:70`).
- `126609555` 커밋이 `(maskSensitiveFields(r.config ?? {}) ?? {}) as Record<string, unknown>` → `r.config ?? {}` 로 단순화하며 불필요한 타입 단언을 제거 — 순환 복잡도가 오히려 낮아졌다.
- `mask-sensitive-fields.util.spec.ts`의 `KEYS = [...DEFAULT_SENSITIVE_KEYS]`는 손-나열 대신 상수에서 실제로 파생하며, `[메타]` 케이스(`KEYS.length > 15`)로 파생 단절을 조기 탐지하도록 설계됐다 — 향후 drift에 강한 패턴.
- 테스트 네이밍(`[캐너리]`/`[대조군]` 접두, 한국어 JSDoc으로 "무엇을 왜 고정하는지" 설명)이 일관되고 가독성이 높다.
- `CHANGELOG.md`의 신규 항목은 같은 클래스 변경마다 남겨 온 이 저장소의 확립된 형식(무엇이 새고 있었는지·운영 영향·안전 전제)을 정확히 따른다.

## 요약

핵심 로직 변경(`handler-output.adapter.ts`의 마스킹 제거, 캐너리 재작성)은 작고 명확하며 두 차례 리뷰를 거치며 오히려 복잡도가 낮아졌다. 이전 라운드가 지적한 체크리스트 drift·측정치 오기·4곳 stale 인용 중 대다수는 후속 커밋으로 실제 해소됐음을 직접 확인했다. 다만 (1) `mask-sensitive-fields.util.ts`의 문법이 깨진 주석 문장이 **두 차례의 "고쳤다" 주장 이후에도** 여전히 남아 있고, (2) 동일 안전 서사가 3개 파일에 근접-중복 서술돼 있으며, (3) 그 서사를 담은 인라인 주석이 코드 대비 과도하게 길다. 셋 다 기능 결함은 아니고 이 PR을 막을 사유도 아니지만, (1)은 "미러 스윕이 몇 곳을 놓친다" 클래스가 같은 PR 안에서 재발한 사례라 별도로 표시했다.

## 위험도

LOW
