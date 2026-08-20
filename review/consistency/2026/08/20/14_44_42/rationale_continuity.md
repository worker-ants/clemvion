# Rationale 연속성 검토 — spec/5-system/ (EIA `inputData` marker guard, 2026-08-20)

## 조사 방법

- target 은 `spec/5-system/` 전역(impl-done, diff-base `origin/main`). 조립된 prompt 는 컨텍스트
  예산 초과로 다수 파일이 절단(`⚠️ 컨텍스트 예산 초과로 생략된 파일 13개`, `28개`)돼 있으나,
  이번 라운드의 실질 변경(`2026-08-20` 로 dated 된 항목)은 모두 포함된 범위(`6-websocket-protocol.md`
  §4.1 캐비엇, `13-replay-rerun.md` §10.2, `14-external-interaction-api.md` §R17 잔여②)에
  들어 있어 조사에 지장은 없었다.
- 이번 라운드는 `spec/5-system/14-external-interaction-api.md` §R17 이 스스로 "잔여 ②" 로
  이름 붙여 열어 두었던 항목 — *"프런트가 마스킹 마커를 감지해 재입력을 강제하는 가드가 서면
  `Execution.inputData` 카브아웃을 닫는다"* — 를 닫는 후속 spec-doc 변경이다(Re-run 모달·
  에디터 히스토리 로드 가드 + REST `Execution.inputData` egress 마스킹 도입).
- 직전 라운드(`review/consistency/2026/08/17/01_17_49/rationale_continuity.md`, 커밋
  `89c3f3c53`)가 남긴 WARNING·INFO 를 이번 target 이 어떻게 반영했는지도 함께 대조했다(연속성
  검토 자체의 연속성).

## 발견사항

- **[INFO]** 직전 라운드(01_17_49)가 남긴 "boundary masking parity 인용 계보" INFO 가 이번
  라운드에도 그대로 남아 있다 — 새로 악화되지는 않았다.
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 값-패턴 마스킹 캐비엇 —
    "`execution:<id>` 구독 인가가... [EIA §R17](./14-external-interaction-api.md) 의 boundary
    masking parity 원칙과 같은 근거다".
  - 과거 결정 출처: 원 출처는 `spec/2-navigation/14-execution-history.md` R-5 이고, EIA §R17
    자신도 "R-5 의 직접 대상은 Config 탭이라 `Execution.error` 를 이미 규정하고 있지는 않다 —
    원칙을 **원용**한 것" 이라 스스로 명시해 뒀다.
  - 상세: WS §4.1 은 이를 "EIA §R17 의" 원칙으로 재인용하는데, 인용의 인용이라 원 출처(R-5)의
    스코프 caveat 이 두 홉 뒤에서 사라진다. 결론 자체는 매 단계 타당하게 재적용되고 있어 오류는
    아니다.
  - 제안: 급하지 않음(직전 라운드와 동일 판단 유지). 다음에 이 인용부를 만질 일이 있으면
    "boundary masking parity 원칙(원 출처 [실행 내역 R-5](../2-navigation/14-execution-history.md#r-5))"
    처럼 한 홉 더 명시.

## 확인했지만 문제 없음으로 판정한 항목

- **[해소 확인] whack-a-mole 반박 보강 — 01_17_49 WARNING 이 그대로 반영됐다.** 직전 라운드는
  EIA §R17 의 egress 마스킹이 `spec/5-system/12-webhook.md` Rationale "민감 헤더 마스킹 —
  ingestion(저장) 시점 채택" 이 명시적으로 기각한 "display 시점 마스킹" 을 다른 데이터
  클래스에 재도입하면서, 기각 근거 중 (b) whack-a-mole 논거를 이름 붙여 반박하지 않았다고
  지적했다. 이번 target 의 `14-external-interaction-api.md` §R17 "언제 가리는가" 절 하단에
  **"webhook Rationale 의 'whack-a-mole' 우려에 대한 답"** 불릿이 정확히 그 제안 문구(공유
  관문 `toResponseExecution`/`emitExecutionEvent`·`emitNodeEvent`/`toTerminalErrorPayload` 로
  수렴시켜 구조적 상속)를 담아 추가돼 있다 — 긴장이 닫혔다.
- **`inputData` 카브아웃 재도입은 실제 이력에 근거한 번복이다 (합격 사례).** §R17 "잔여 ②"
  블록은 (a) 왜 한동안 카브아웃했는지(재제출 오염, 2026-08-17 이전) (b) 왜 지금 닫는지(마커
  가드 3곳 완비, 표로 소비처·시점 열거) (c) 판단 기준 자체가 "외부 노출 여부" 단일 축에서
  "외부 노출 ∨ 예외 유지비 > 가드 비용" 2축으로 바뀐 이유(6개 spec 파일이 그 예외를 SoT 로
  인용하게 되며 유지비가 역전) 를 전부 명시한다. `feedback_rationale_rejected_alternatives_need_history`
  기준(지어낸 이력 금지)도 충족 — 인용된 세션 ID(`23_49_05`/`23_50_03`/`01_17_49`)가 실제
  `review/consistency/2026/08/16,17/**` 커밋 이력과 대조로 확인됐다.
  `git log --all --diff-filter=A --name-only` 로 세 세션 산출물의 실존을 확인.
- **RR-PL-02 "왜 B2(원본 미리보기+편집)" 와의 관계.** 새 §10.2 캐비엇(마스킹 마커 필드는
  프리필하지 않고 재입력 강제)은 RR-PL-02 Rationale 이 정한 일반 기본값(원본 미리보기+편집)의
  전면 번복이 아니라, "값이 credential-마스킹 마커인 경우" 로 스코프가 좁은 예외다. 이 문서군이
  이미 확립한 "논리 표기 유지 + 구현현실 caveat" 패턴(WS §4.4 wire caveat, EIA §6.2 SSE
  caveat)과 동일한 방식으로 처리돼 있어 별도 Rationale 개정 없이도 정합적이다.
- **"레벨이 가른다" 축 폐기가 문서 전역에서 일관됨.** WS §4.1 캐비엇(`Execution.inputData`도
  마스킹, 2026-08-20)·§R17 "input/inputData 는 두 레벨 모두 마스킹"·webhook §5.3 캐비엇(egress
  후속 층 언급) 세 곳 모두 같은 날짜·같은 근거로 갱신돼 있고, 폐기된 옛 축("레벨이 가른다")을
  재긍정하는 잔존 문구는 없었다(grep 대조 완료).
- **잔여③(workflow-assistant `explore-tools.service.ts`) 은 의도적으로 범위 밖에 유지되며,
  §R17 의 "적용 범위는 열거다"(6곳) 테이블과 스코프가 겹치지 않아 완전성 과장(overclaim) 도
  없다.**
- **`llmCalls` strip-only 결정(WS Rationale, 2026-06 확정)은 이번 라운드에서도 번복되지
  않았다** — §4.1 값-패턴 마스킹 캐비엇이 "예외는 `llmCalls` 하나" 라고 명시적으로 유지.

## 요약

이번 EIA `inputData` marker-guard 라운드는 Rationale 연속성 관점에서 위반이 없다. 핵심 변경
(`Execution.inputData` REST egress 마스킹 재도입)은 §R17 이 스스로 열어 둔 "잔여 ②" 조건을
실제로 충족한 뒤(Re-run 모달·에디터 히스토리 로드 마커 가드 완비) 닫은 것으로, 과거에 같은
카브아웃을 만들었던 근거(재제출 오염)를 무시하지 않고 오히려 그 근거가 왜 더 이상 유효하지
않은지(가드가 오염 경로를 차단)를 명시했다. 직전 라운드(01_17_49)가 남긴 WARNING(whack-a-mole
반박 누락)은 이번 target 에 문구 그대로 보강돼 해소가 확인됐고, 그때의 INFO(R-5 인용 계보)만
동일 강도로 남아 있다 — 새로 발생한 긴장은 없다.

## 위험도

NONE
