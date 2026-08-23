# 문서화(Documentation) 리뷰 — swagger-decisions 재검토 (12_22_08 RESOLUTION 반영 후)

## 배경

이번 diff 는 이전 리뷰 라운드(`12_22_08`)가 지적한 WARNING 3건에 대한 `RESOLUTION.md` 반영본을
포함한다. 실질 코드 변경은 `ExecuteWorkflowDto.input` 의 `deprecated: true` + JSDoc, 이를 고정하는
`workflows-execute-body.spec.ts` 신규 테스트뿐이며, 나머지는 `spec/conventions/swagger.md` 개정과
plan/tracker 문서, 그리고 전 라운드의 review/consistency 산출물 커밋이다. 이전 라운드가 지적한
3건의 WARNING 이 실제로 해소됐는지를 소스를 직접 열어 재검증했다.

## 검증 절차 (독립 재현)

- `grep -n "ㆍ" spec/conventions/swagger.md` → 0건. W2(유니코드 오타 `ㆍ`→`·`) 정정 확인.
- `python3 scripts/check-doc-links.py --root .` → `BROKEN=2`, 둘 다 `swagger.md` 와 무관한 선존
  결함(`7-channel-web-chat/1-widget-app.md`, `spec-impl-evidence.md`). `swagger.md` 관련 신규 깨진
  링크/앵커 0건 — W1 반영 시 헤딩을 바꾸면서(`### §3 보안·정책 캐비엇 예외 — …` →
  `### §3 보안·정책 캐비엇 — 왜 길이를 이유로 줄이지 않는가, …`) 앵커도 함께 갱신됐고
  (`#3-보안정책-캐비엇--왜-길이를-이유로-줄이지-않는가-그리고-왜-양방향인가`), 이 스크립트는
  GitHub-style slug 매칭까지 검사하므로 링크가 실제로 유효함을 확인했다.
- `spec/conventions/swagger.md:471-482` 를 직접 읽어 W1 을 확인 — 섹션 제목·첫 문장이 "지시"
  프레이밍으로 바뀌었고, `> 2026-08-17~08-22 에는 이걸 "예외" 라고 불렀다 … 2026-08-23 개정으로
  … "지시" 로 뒤집혔다` blockquote 로 **이력을 지우지 않고** 왜 프레이밍이 바뀌었는지 남겼다.
  §3 본문 콜아웃(`:271-286`)의 근거 링크 텍스트도 "예외"→"" (제목 없이 앵커만 인용)로 정합됨.
- `plan/in-progress/swagger-decisions.md:53-55` 를 직접 읽어 W3 확인 — "엔드포인트 `description`
  (50~150자)도 **그대로 강제 유지**한다. 비강제로 돌리는 것은 **DTO `description` 하나뿐**이다"
  문장이 추가돼, 이전에 누락됐던 세 번째 축(엔드포인트 description)이 이제 본문에 명시됨.
- `codebase/backend/src/modules/workflows/workflows.controller.ts:304-323` 을 열어 DTO JSDoc 이
  주장하는 `body?.parameterValues ?? body.input.parameters` 병합과 `resolveTriggerParametersRejectingMasked`
  단일 호출 구조가 실제 코드와 정확히 일치함을 재확인.
- `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts:31` 을 열어
  `{@link ExecuteNodeDto.input}` 참조 대상이 실재함을 확인.
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:155-168` 를 열어 신규
  테스트 docstring("`input` 만 deprecated…", "대조군 필요")과 실제 단언
  (`input.deprecated).toBe(true)` / `preferred.deprecated).toBeFalsy()`) 이 정확히 일치함을 확인.

## 발견사항

이전 라운드가 지적한 3건의 WARNING(§3 프레이밍 불일치, 유니코드 오타, plan ③ 서술 누락 축)은
모두 위 절차로 **독립 재현·검증돼 정확히 해소됐다**. 이번 라운드에서 새로 지적할 CRITICAL/WARNING
급 문서화 결함은 발견되지 않았다.

- **[INFO]** `plan/in-progress/swagger-decisions.md` 결정 요약 표의 "성격" 열이 여전히 행마다 다른
  범주(① 변경 성질 vs ②·③ 담당자)를 섞어 담고 있다 — 이전 라운드 INFO 로 이미 지적됐고
  `RESOLUTION.md` 는 WARNING 3건만 반영 대상으로 삼아 이 항목은 손대지 않았다(의도된 낮은 우선순위
  처분).
  - 위치: `plan/in-progress/swagger-decisions.md:17-21`
  - 상세: 재확인 결과 여전히 동일 상태. 새로 발생한 문제는 아니며 blocking 사유 아님.
  - 제안: 필요 시 열을 "성격"/"담당"으로 분리. 강제 아님.

- **[INFO]** `deprecated: true` 에 대한 `CHANGELOG.md` 미기록 — 이전 라운드 INFO 가 근거로 든
  선례(`GET /api/model-configs/:id/models` 의 `@ApiQuery enum`)를 대조해 보니, 그 선례는
  **런타임 검증이 실제로 추가돼 400 을 낼 수 있는** 변경(스펙 미준수 클라이언트에 영향)이었던
  반면, 이번 `deprecated: true` 는 런타임 동작이 전혀 바뀌지 않는 순수 스키마 플래그다
  (`CHANGELOG.md:1224` 대조 확인). 즉 선례보다 훨씬 약한 변경이라 `RESOLUTION.md` 의 "기록 불요"
  판단(INFO#5)이 실제로는 이전 라운드가 제시한 선례보다 더 잘 뒷받침된다.
  - 위치: `CHANGELOG.md:1224`(대조 선례), `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:60-67`
  - 상세: 확인성 기록 — 조치 불요.
  - 제안: 없음.

## 미검출(양호하게 처리된 항목)

- W1 fix 는 "제목·첫 문장만 갈아치우고 이력을 지우는" 얕은 수정이 아니라, 왜 한때 "예외" 였고
  무엇이 바뀌어 "지시" 로 뒤집혔는지를 blockquote 로 남겨 다음 독자가 논거 자체가 바뀐 것으로
  오해하지 않게 했다.
- 앵커 변경(`swagger.md:269`, `:286`)이 실제 헤딩 슬러그와 정확히 일치함을 `check-doc-links.py`
  (GitHub-style slug 매칭 포함)로 확인 — 링크 텍스트만 바꾸고 앵커를 깜빡하는 흔한 실수 없음.
- `swagger.md` 신설 `### §3 DTO 길이는 왜 강제가 아닌가` 절은 재실측치(`114/333` vs `116/335`)
  차이의 원인(모집단 변화)까지 각주로 밝혀 "실측이 틀렸나?" 라는 다음 사람의 의심을 선제 차단한다.
- DTO JSDoc·테스트 docstring 모두 실제 컨트롤러 병합 로직·형제 DTO 필드와 line-level 로 일치함을
  직접 소스 대조로 확인 — 오래된 주석(stale comment) 없음.

## 요약

이전 라운드(`12_22_08`)가 지적한 문서화 WARNING 3건(§3 "예외→지시" 재정의와 미변경 Rationale
간 용어 불일치, 유니코드 가운뎃점 오타, plan `## ③` 서술의 축 누락)은 모두 소스를 직접 열고
`check-doc-links.py` 로 앵커까지 재검증한 결과 정확하고 완전하게 해소됐다. 앵커 갱신은 얕은
문구 교체가 아니라 실제 슬러그 일치까지 확인됐고, "예외→지시" 재프레이밍은 이력을 지우지 않는
방식으로 반영됐다. 이번 라운드에서 새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다. 남은 것은
이미 저 라운드에서 낮은 우선순위로 처분된 INFO 2건(plan 표 열 범주 혼용, CHANGELOG 미기록)뿐이며,
후자는 재검토 결과 오히려 처분 근거가 이전 라운드가 든 선례보다 더 타당함을 확인했다.

## 위험도

NONE
