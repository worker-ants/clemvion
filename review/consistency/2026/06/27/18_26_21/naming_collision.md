## 발견사항

- **[INFO]** `ModelInfoDto` 와 기존 `ModelInfo` 인터페이스의 병렬 표현
  - target 신규 식별자: `ModelInfoDto` (`codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:76`)
  - 기존 사용처:
    - `ModelInfo` interface — `codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts:75` (도메인 인터페이스)
    - `ModelInfo` interface — `codebase/frontend/src/lib/api/model-configs.ts:67` (프론트엔드 API 타입)
  - 상세: 세 심볼 모두 `{ id: string, name: string, type: 'chat' | 'embedding' }` 로 구조가 동일하다. 백엔드 도메인 레이어(`ModelInfo`)와 Swagger DTO 레이어(`ModelInfoDto`)가 의도적으로 미러링되는 것으로, DTO 주석에도 "충실히 미러한다" 라고 명시되어 있다. 네임스페이스 충돌(같은 스코프에서 다른 의미로 쓰이는 경우)은 아니다. 단, `Dto` suffix 만이 유일한 구분자이므로 import 혼동 가능성이 있다.
  - 제안: 현재 구조가 적절하다. 추후 `ModelInfo` shape 이 변경될 때 `ModelInfoDto`·프론트엔드 `ModelInfo` 도 함께 갱신해야 하는 3중 관리 지점임을 주의.

- **[INFO]** 폐기된 `ModelListDto` / `ModelItemDto` 참조가 dist 빌드 산출물에 잔존
  - target 신규 식별자: (신규 도입 없음, 삭제)
  - 기존 사용처: `codebase/backend/dist/modules/llm/llm-model-config.controller.d.ts`, `codebase/backend/dist/modules/model-config/dto/preview-model-list.dto.d.ts` (컴파일 산출물)
  - 상세: `src/` 에서는 `ModelListDto`·`ModelItemDto` 참조가 완전히 제거되었다. `dist/` 의 `.d.ts` 파일은 stale 빌드 산출물로, 다음 `tsc` 빌드 시 자동 갱신된다. 소스 수준 잔류 참조 없음.
  - 제안: 조치 불필요. CI 빌드가 정상 통과하면 자동 해소.

- **[INFO]** `PreviewModelListDto` 이름과 응답 타입 변경의 의미 상 괴리
  - target 신규 식별자: (해당 없음)
  - 기존 사용처: `codebase/backend/src/modules/model-config/dto/preview-model-list.dto.ts:41` (요청 DTO)
  - 상세: `PreviewModelListDto` 는 preview 요청(자격증명 제출) DTO 로서 `"ModelList"` 가 들어있지만, 이 변경 이후 응답은 `ModelInfoDto[]` bare 배열이다. 이름 충돌이 아니라 역할이 다른 DTO 이므로 문제없다.
  - 제안: 혼동을 줄이려면 장기적으로 `PreviewModelListDto` → `PreviewModelsRequestDto` 등으로 rename 을 고려할 수 있지만 현 시점 필수는 아니다.

## 요약

이번 변경이 도입하는 유일한 신규 식별자는 `ModelInfoDto` 이다. 이 이름은 기존 코드베이스에서 다른 의미로 사용된 선례가 없으며, 동일 이름의 클래스·인터페이스와의 직접적인 충돌도 없다. 기존 `ModelInfo` 인터페이스(백엔드 도메인, 프론트엔드 API 타입)와 구조가 동일하나 이는 설계 의도(DTO = wire 계층 미러)로서 정상이다. `ModelListDto`·`ModelItemDto` 는 `src/` 에서 완전히 제거되었으며, `dist/` 잔존은 빌드 아티팩트 수준으로 실질 충돌이 없다.

## 위험도

LOW
