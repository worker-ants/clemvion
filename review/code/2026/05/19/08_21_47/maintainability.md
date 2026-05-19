# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `isOptionalRecipientSet` 함수의 반환 로직이 다소 암묵적임
  - 위치: `send-email.schema.ts` — `isOptionalRecipientSet` 함수 (전체 파일 컨텍스트 기준 1205~1211 라인)
  - 상세: 함수가 `undefined | null` 이면 `false`, 빈 배열이면 `false`, 그 외는 무조건 `true` 를 반환한다. "그 외" 케이스에는 잘못된 타입(number, string 등)도 포함되는데, 함수 이름 `isOptionalRecipientSet` 만으로는 "잘못된 타입도 'set' 으로 간주해 이후 `isRecipientsLike` 가 reject 하도록 의도적으로 통과시킨다"는 설계 의도가 드러나지 않는다. 주석이 한국어로 보완되어 있지만 함수 시그니처 수준의 명확성은 부족하다.
  - 제안: 함수 이름을 `isOptionalRecipientFieldPresent` 또는 `shouldValidateOptionalRecipient` 처럼 "검증을 수행해야 하는가" 의 의미가 담기도록 변경하거나, JSDoc 한 줄을 영문으로 추가해 "non-null, non-empty-array → let `isRecipientsLike` decide" 의도를 명시하면 가독성이 높아진다.

- **[INFO]** `normalizeRecipients`의 defensive `return []` 분기가 dead code에 가까워졌으나 주석만으로 설명됨
  - 위치: `send-email.handler.ts` — `normalizeRecipients` 함수 diff (238~256 라인)
  - 상세: 변경 후 `!Array.isArray(value) → return []` 분기는 정상 실행 경로에서는 도달할 수 없다고 주석으로 설명되어 있다. 주석이 상세하고 영문으로 잘 작성되어 있어 의도는 전달되지만, "왜 제거하지 않고 남겼는가(레거시 데이터 안전망)"라는 배경을 파악하려면 긴 주석을 끝까지 읽어야 한다.
  - 제안: 함수 상단에 단 한 줄의 요약 주석을 추가하는 것으로 충분하다. 예: `// Returns [] for non-array input (legacy safety net; see block comment below).` 이렇게 하면 함수 본체를 읽기 전에 의도를 파악할 수 있다. 현재 상태도 이해 가능한 수준이며 심각하지는 않다.

- **[INFO]** 테스트 케이스 설명(it 문자열)의 언어 혼용
  - 위치: `send-email.handler.spec.ts` 및 `send-email.schema.spec.ts` 전반
  - 상세: 한국어와 영어가 섞여 있다. 예를 들어 `send-email.schema.spec.ts`의 `describe` 블록 중 일부는 한국어(`'빈 config 는 기본값으로 채워짐'`), 일부는 영어(`'returns [] when to is a non-empty array of strings'`)를 사용한다. 이번 변경에서 추가된 케이스들은 영어로 통일되어 있어 변경분 자체는 일관성이 있으나, 기존 테스트와의 언어 불일치가 지속된다.
  - 제안: 테스트 언어 컨벤션을 팀 차원에서 결정하고 새 케이스부터 통일한다. 이번 변경 범위 내 수정까지 강제하는 것은 부담이나, 팀 컨벤션 문서에 명시해 두면 향후 누적을 방지할 수 있다.

- **[INFO]** `backend-labels.ts` 에 추가된 항목이 알파벳 정렬 순서를 깨고 있음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` — diff 362~302 라인
  - 상세: 기존 `WARNING_KO` 객체의 키들이 알파벳 순으로 정렬되어 있는데, 이번에 추가된 세 개의 키(`"bcc must..."`, `"cc must..."`, `"to is required..."`)가 `"Y-axis field..."` / `"branchCount..."` 뒤에 삽입되어 정렬이 무너졌다. 실제 동작에 영향은 없지만 향후 유지보수자가 기존 번역 항목을 탐색할 때 혼란을 줄 수 있다.
  - 제안: 추가된 항목을 알파벳 순서에 맞는 위치(b... 섹션 초입)로 이동시킨다. "bcc" → 기존 "b" 항목들 사이, "cc" / "to is" → 각 알파벳 위치. 또는 파일에 별도 섹션 구분 주석(`// send-email`)을 두는 방식도 허용 가능하지만 기존 패턴과 통일이 필요하다.

- **[INFO]** `send-email.schema.ts` 의 `warningRules` 주석에 구형 sum-type 언급이 잔존
  - 위치: `send-email.schema.ts` 전체 파일 컨텍스트 — `warningRules` 바로 위 주석 블록 (1243~1252 라인)
  - 상세: `// Recipient sum-type validation (string | string[]) lives in \`validateConfig\`` 라는 주석이 array-only 정준화 이후에도 남아 있다. 이 주석은 `validateSendEmailConfig` JSDoc 에서 이미 구버전 sum-type이 폐기되었다고 설명하는 내용과 모순된다. 기능 동작에는 영향이 없으나 유지보수자가 혼란을 겪을 수 있다.
  - 제안: 해당 주석 마지막 문장을 `// Recipient validation (array-only, see validateSendEmailConfig below) lives in \`validateConfig\`.` 로 갱신한다.

## 요약

이번 변경은 `to / cc / bcc` 필드를 array-only 로 좁히는 정준화 작업으로, 변경 범위 내의 코드는 전반적으로 읽기 쉽고 잘 구조화되어 있다. `normalizeRecipients` 와 `isRecipientsLike` 의 단순화는 가독성과 복잡도 양쪽에서 긍정적이며, 관련 테스트 케이스들도 변경 의도를 명확하게 기술하고 있다. 발견된 문제는 모두 INFO 수준으로, `isOptionalRecipientSet` 의 네이밍 불명확성, 다국어 번역 파일의 정렬 일관성 깨짐, 테스트 파일 내 한국어/영어 혼용, 그리고 정준화 이후 잔존하는 구형 sum-type 언급 주석 정도이다. 기능 정확성이나 아키텍처적 결함은 없으며 낮은 위험도로 판단한다.

## 위험도

LOW
