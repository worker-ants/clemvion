## 발견사항

- **[INFO]** 외부 의존성 변경 없음
  - 위치: 전체 diff
  - 상세: 이번 변경에서 새로운 외부 패키지나 라이브러리가 추가되지 않았습니다. 기존 import 경로(`../../core/*`, `../../../modules/llm/*`) 그대로 유지됩니다.
  - 제안: 해당 없음

- **[WARNING]** `output._llmCalls` → `meta.llmCalls` 내부 API 계약 파기
  - 위치: `text-classifier.handler.ts` diff — catch 블록 내 반환 구조
  - 상세: 에러 경로에서 `output._llmCalls` 배열이 제거되고 `meta.llmCalls` 로 이동했습니다. 접두사 `_` 는 내부 전용임을 암시하지만, 이 필드를 `output.*` 경로로 직접 참조하는 다운스트림 코드(workflow expression `$node[X].output._llmCalls`)가 있다면 조용히 `undefined` 로 깨집니다. 성공 경로의 `llmCalls` 는 이미 `meta.*` 에 있었으므로 에러 경로만 뒤처진 상태였는데, 이 변경으로 두 경로가 정합됩니다.
  - 제안: 배포 전 `grep -r '_llmCalls'` 로 다른 소비 지점이 없는지 확인하거나, 있다면 마이그레이션 노트를 추가합니다.

- **[INFO]** `requestPayload`(사용자 입력 전문) 가 `meta.llmCalls[0].requestPayload` 로 노출됨
  - 위치: `text-classifier.handler.ts:162` 부근 catch 반환 / 성공 경로 `llmCalls` 동일
  - 상세: `requestPayload.messages[1].content` 에는 `inputField` 가 평가된 실제 텍스트(PII 가능)가 들어갑니다. `meta` 가 로그·모니터링 파이프라인으로 흘러가는 시스템이라면 해당 데이터가 외부 스토리지에 기록되는 의존 경로가 생깁니다. 성공 경로도 동일하게 이미 노출 중이므로 이번 변경이 새로운 위험을 추가하는 것은 아닙니다.
  - 제안: 메타 직렬화 레이어(로그 싱크 등)에서 `requestPayload.messages` 를 별도 마스킹하는 정책 여부를 확인합니다.

- **[INFO]** `errorDurationMs` 값이 `meta.durationMs` 와 `meta.llmCalls[0].durationMs` 에 중복 기록됨
  - 위치: `text-classifier.handler.ts` catch 블록
  - 상세: 동일 변수를 두 필드에 할당하는 것은 데이터 의존 관계를 단순화하지만, 성공 경로(`llmCalls[0].durationMs = Date.now() - callStartedAt`, `meta.durationMs` 는 엔진 주입)와 출처 기준이 다릅니다. 에러 경로에서는 핸들러가 직접 둘 다 채우므로 엔진 주입이 이후 덮어쓸 경우 `meta.durationMs` 가 두 번 기록될 수 있습니다.
  - 제안: 엔진이 `meta.durationMs` 를 덮어쓰는 정책(spec §5.1 테이블: `engine inject`)과 에러 경로 핸들러 직접 주입의 우선순위를 문서화합니다.

---

## 요약

이번 변경은 외부 패키지 의존성을 전혀 추가하거나 변경하지 않는 순수 내부 구조 정합 작업입니다. 주의할 점은 에러 경로의 `output._llmCalls` 가 제거되어 내부 API 계약이 변경된다는 것으로, 다운스트림 expression 이 해당 필드를 참조하고 있다면 조용한 회귀가 발생할 수 있습니다. 그 외 라이선스·취약점·번들 크기 관점에서는 리스크가 없습니다.

## 위험도

**LOW**