STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[WARNING]** 테스트 파일 JSDoc 헤딩이 여전히 정반대(구) 결론을 현재형으로 단언 — 자매 파일(DTO)은 같은 패턴을 올바르게 고쳤는데 이 파일만 놓쳤다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1109` (`## \`inputData\` 는 **의도적으로 대상이 아니다**` 헤딩. 블록 전체는 1106~1129행, `describe('outputData + inputData 마스킹 …')` 바로 위)
  - 상세: 이 JSDoc 블록의 소제목(1109행)은 지금도 `"inputData 는 의도적으로 대상이 아니다"` 라고 현재형으로 못박고 있다. 이번 diff 는 그 아래 본문 문장의 시제만 과거형으로 바꾸고(`"...된다"` → `"...됐다"`) `"두 게이트가 독립으로 CRITICAL 을 냈고..."` 뒤에 `> **2026-08-20 — 카브아웃이 닫혔다.**` 로 시작하는 정정 blockquote 를 새로 추가했다 — 즉 결론을 뒤집는 정정문은 **본문 중간에 인용구로만** 들어갔고, 그 위 소제목 자체는 갱신되지 않았다. 결과적으로 이 블록을 위에서부터 읽는 독자는 소제목("의도적으로 대상이 아니다") → 본문 3문장(왜 마스킹하면 안 되는지 설명) 까지는 옛 결론 그대로를 읽게 되고, 그 다음에야 정정 blockquote 를 만난다. 바로 아래 `describe('outputData + inputData 마스킹 — 표면 전수 (2026-08-20 부터 두 레벨 모두)', ...)` 이름과 그 안의 `expect(result.inputData.note).not.toContain('admin:pw')` 단언(1158~1159행 부근, 이번 diff 에서 반전됨)은 소제목과 정반대를 검증한다.
    같은 PR 의 자매 파일 `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 는 정확히 같은 상황(직전 라운드 리뷰가 CRITICAL 로 잡은 "인용만 고치고 본문 주장은 방치" 패턴)에서 **첫 문장(주제문) 자체를 현재형으로 재작성**(`"**값-패턴 마스킹 대상이다**"`)하고 옛 서술은 `> 2026-08-20 이전에는 ...` blockquote 로 내려보냈다 — 이 파일이 그 자매가 이미 정착시킨 올바른 패턴을 놓친 유일한 자리다.
  - 제안: 1109행 소제목을 현재 진실("두 레벨 모두 마스킹 대상")로 재작성하고, `"초안은 두 컬럼을 함께 마스킹했다가 되돌렸다..."` 이하 옛 설명은 `execution-response.dto.ts` 와 동일하게 `> 2026-08-20 이전에는 ...` 형태의 역사적 caveat 로 재배치한다.

- **[INFO]** 같은 작업을 가리키는 두 문서(plan 제목 vs CHANGELOG 제목)가 "소비처 개수"를 다른 기준으로 세어 나란히 읽으면 모순처럼 보인다
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md` (frontmatter `title`, "재제출 소비처 **2곳**에 마커 가드 선행") vs `CHANGELOG.md:3` ("재제출 소비처 **3곳**에 마커 가드")
  - 상세: 두 서술 모두 각자의 본문 안에서는 내적으로 일관된다 — plan 은 "이 작업이 새로 추가하는 소비처"(Re-run 모달·에디터 히스토리 로드) 2곳만 세고, CHANGELOG 는 "닫는 조건을 충족한 총 소비처"(#1181 폼 프리필 포함) 3곳을 센다. 실제 모순은 아니지만, plan 제목만 보거나 CHANGELOG 제목만 보는 사람에게는 숫자가 결론에서 어긋나 보일 수 있다.
  - 제안: 조치 불요에 가깝지만, plan 제목에 "(총 3곳 중 나머지 2곳)" 같은 짧은 한정어를 붙이면 두 문서를 나란히 볼 때의 혼동을 없앨 수 있다.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을 CHANGELOG·plan·spec 7개 파일·backend DTO 2개·유저 가이드 4개(ko/en × 2)·신규 `masked-markers.ts` 유틸·다수 테스트 파일에 걸쳐 광범위하고 대체로 정확하게 반영했다. 직전 라운드 리뷰가 CRITICAL 로 잡았던 "`ExecutionDto.inputData` JSDoc 방치"는 이번 diff 에서 정확히 자매 파일(`NodeExecutionSummaryDto`, `background-run-response.dto.ts`)과 같은 형태로 올바르게 고쳐졌고, spec 소제목(`spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md` §R17)도 "레벨이 가른다" 축 폐기를 현재형으로 정확히 반영했다. 유저 가이드 MDX 4파일 동반 갱신, 신규 i18n 키 ko/en parity, `MASKED_INPUT_DATA_REASON` 앵커 전수 삭제(코드베이스 grep 0건 실측 확인)도 모두 주장대로 완결돼 있다. 다만 같은 "주제문 방치" 결함 클래스가 `executions.service.spec.ts` 의 describe JSDoc 소제목 한 곳에서 재발했다(WARNING) — 기능·테스트 자체는 올바르게 반전됐으므로 실질 위험은 낮지만, 이 저장소가 반복 겪어 온 "부분 편집이 헤딩만 남긴다" 패턴의 재발이라 정정을 권한다.

## 위험도

LOW
