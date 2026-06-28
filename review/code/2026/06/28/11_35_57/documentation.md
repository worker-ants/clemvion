# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[INFO]** 테스트 `describe` 블록 내 JSDoc 설명이 충분하고 정확함
  - 위치: `codebase/backend/src/common/cors/web-chat-cors.spec.ts` L167-171 (새 `describe` 블록 내부 주석)
  - 상세: 추가된 `describe('CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)')` 블록 안에 목적(회귀 방지), 대상 헤더, 테스트가 잡아내는 변경 유형이 JSDoc 형식으로 명확히 기술되어 있음. 품질 적절.
  - 제안: 현행 유지.

- **[INFO]** `CorsOptionsLike.exposedHeaders` 필드 JSDoc이 이미 존재하고 정확함
  - 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` L24-29
  - 상세: 구현 파일의 `exposedHeaders` 인터페이스 필드에 이미 `X-Deleted-Count` 사용 예와 미설정 시 결과를 명시한 JSDoc이 있음. spec 변경과 일치하여 주석 정확성 문제 없음.
  - 제안: 현행 유지.

- **[INFO]** `spec/5-system/17-agent-memory.md` Rationale 섹션에 신규 결정 배경이 적절히 추가됨
  - 위치: `spec/5-system/17-agent-memory.md` L310-319 (`### scope 전체 삭제 — X-Deleted-Count 커스텀 응답 헤더 채택 (AGM-13)`)
  - 상세: 커스텀 응답 헤더 채택 이유(204 body 금지, 최소 노출, 단건 비대칭), CORS exposedHeaders 필수성, 장기 spec 트랙 이관 계획까지 기록되어 설계 결정의 근거를 충분히 문서화했음.
  - 제안: 현행 유지.

- **[INFO]** AGM-13 요구사항 ID 정의에 X-Deleted-Count 및 CORS 요건이 추가됨
  - 위치: `spec/5-system/17-agent-memory.md` L301 (요구사항 `AGM-13` bullet)
  - 상세: 요구사항 ID 수준에서 `X-Deleted-Count: <n>` echo와 `exposedHeaders` 포함 필수를 명시해 구현과 spec 정합성이 확보됨.
  - 제안: 현행 유지.

- **[WARNING]** 테스트가 실제 `defaultOptions` 함수가 아닌 로컬 정의 객체를 검증함 — 회귀 방지 의도와 불일치할 수 있어 주석이 약간 오해를 유발할 수 있음
  - 위치: `codebase/backend/src/common/cors/web-chat-cors.spec.ts` L173-181
  - 상세: 테스트 블록 주석은 "defaultOptions 에서 exposedHeaders 를 제거하거나 헤더 이름을 변경할 때 회귀를 잡아낸다"고 설명하지만, 실제로 테스트 내부에서 별도 로컬 `defaultOptions` 함수를 선언해 검증함. 구현 파일의 실제 `defaultOptions` 팩토리(프로덕션 코드)가 아닌 테스트 내 인라인 객체를 asserting하므로, 프로덕션 CORS 설정에서 `exposedHeaders` 가 누락되어도 이 테스트는 통과한다. 주석이 설명하는 "회귀 방지" 범위와 실제 테스트 범위가 다름.
  - 제안: 주석을 "이 테스트는 CorsOptionsLike 타입이 exposedHeaders 필드를 지원함을 검증하고, 프로덕션 defaultOptions 팩토리가 X-Deleted-Count 를 포함해야 함을 명세로 고정한다" 수준으로 범위를 정확히 기술하거나, 또는 실제 프로덕션 `defaultOptions` 호출 결과를 asserting 하는 방향으로 테스트 자체를 수정하여 주석과 실제 검증 범위를 일치시키는 것을 권장.

- **[INFO]** API 표 셀 단순화 — 상세 내용은 bullet으로 이동, 중복 제거
  - 위치: `spec/5-system/17-agent-memory.md` L292 (표 행 변경)
  - 상세: 표 셀에서 장문 설명을 제거하고 "상세 → 아래 bullet" 참조로 단순화한 변경은 문서 가독성을 높이며, 상세 내용은 L453 bullet에 통합되어 정보 유실 없음.
  - 제안: 현행 유지.

- **[INFO]** `spec/5-system/2-api-convention.md` 업데이트 미완 — 단 의도적 defer
  - 위치: `spec/5-system/17-agent-memory.md` L318 (Rationale 장기 항목)
  - 상세: X-Deleted-Count 패턴을 API 컨벤션 문서에 등재하는 작업이 본 PR 범위 외로 명시 이관됨. 의도적 defer이며 Rationale에 기록되어 있으므로 추적 가능.
  - 제안: 후속 spec 트랙에서 `spec/5-system/2-api-convention.md` 업데이트 필요. 현 PR에서는 INFO 수준.

## 요약

이번 변경은 spec 문서(`spec/5-system/17-agent-memory.md`)와 테스트 파일(`web-chat-cors.spec.ts`) 두 곳에 걸친 문서화 작업으로, 전반적으로 문서화 품질이 높다. spec의 AGM-13 요구사항 ID에 `X-Deleted-Count` + CORS `exposedHeaders` 요건이 명시되었고, Rationale 섹션에 설계 결정 근거가 충실히 기록되었으며, API 표의 중복 기술이 정리되었다. 한 가지 주의할 점은 새로 추가된 테스트 블록의 주석이 "실제 프로덕션 defaultOptions 회귀를 잡아낸다"고 선언하지만, 테스트 내부에서는 로컬 인라인 객체를 검증하므로 주석이 설명하는 범위와 실제 검증 범위 사이에 간극이 있다. 이는 테스트의 유효성에 영향을 주는 사항으로 주석 수정 또는 테스트 수정이 권장된다. 그 외 모든 문서화 측면은 적절하며 구현·spec·주석 간 정합성이 잘 유지된다.

## 위험도

LOW
