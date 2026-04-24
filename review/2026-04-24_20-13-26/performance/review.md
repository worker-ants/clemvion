### 발견사항

- **[INFO]** `.default('')` 의 ZodDefault 래퍼 체인 추가
  - 위치: `send-email.schema.ts` — `subject`, `body` 필드
  - 상세: `.optional()` → `.default('')` 변경 시 Zod 내부적으로 `ZodDefault<ZodString>` 래퍼가 추가되어 파싱 시 메서드 체인이 한 단계 더 깊어진다. 단, 스키마 객체는 모듈 로드 시 1회 생성되는 싱글턴이고, 파싱 경로 차이는 나노초 수준이다. 빈 문자열(`''`)은 JS 엔진에서 인터닝되므로 파싱 시 undefined → `''` 대입도 추가 힙 할당이 아니다.
  - 제안: 현재 변경 유지. 성능 회귀 없음.

- **[INFO]** `caseDefSchema` 에 `.optional()` 필드 추가
  - 위치: `switch.schema.ts` — `id` 필드
  - 상세: 스키마 객체 정의 시 `ZodOptional<ZodString>` 노드 하나 추가. 모듈 초기화 비용이 미세하게 증가하나 요청 경로와 무관하다. 이미 존재하던 `.passthrough()` 가 미적용 키를 spread하는 비용이 이 추가보다 크지만 역시 측정 불가 수준이다.
  - 제안: 현재 변경 유지. 성능 회귀 없음.

- **[INFO]** plan/node-schema-audit.md — F-4 의 `.passthrough()` 추가 예고
  - 위치: `F-4` 항목 (`http-request.schema.ts` keyValueSchema)
  - 상세: `.passthrough()` 는 Zod 기본값인 `.strip()` 대비 파싱 시 unknown 키를 spread해 결과 객체에 포함시킨다. headers/queryParams/cookies 가 수십 개의 키를 가진 요청이 고빈도로 들어온다면 측정 가능한 차이가 생길 수 있다. 그러나 이 노드 특성상 키 수가 적고 이미 다른 노드에서 동일 패턴을 쓰고 있으므로 실질적 위험은 낮다.
  - 제안: F-4 조치 시 벤치마크 불필요. 단, 만약 요청당 파싱 횟수가 매우 높은 hot-path 라면 `.passthrough()` 대신 소비자 코드에서 필요한 키만 직접 꺼내는 방식도 고려 가능.

---

### 요약

이번 변경의 세 파일 모두 런타임 성능과 직접 연관된 알고리즘·I/O·메모리 패턴에 변화가 없다. `send-email`의 `.default('')` 와 `switch`의 `id` 필드 추가는 모두 모듈 로드 시 1회 실행되는 정적 스키마 정의 변경이며, 파싱 경로의 차이는 측정 불가 수준이다. 계획 문서(node-schema-audit.md)에 기록된 follow-up 항목들 역시 성능 위기보다는 정합성·안정성 개선 사안이다.

### 위험도

**NONE**