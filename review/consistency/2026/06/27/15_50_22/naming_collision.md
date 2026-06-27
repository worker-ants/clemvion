# 신규 식별자 충돌 검토

검토 대상 diff: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`
검토 기준 문서: `spec/2-navigation/6-config.md`

---

## 신규 식별자 목록

diff 가 도입하는 신규 식별자(모두 파일-로컬 모듈 스코프):

| 식별자 | 종류 | 값 |
|--------|------|-----|
| `PROVIDER_PROBE_THROTTLE` | `const` | `{ default: { ttl: 60_000, limit: 10 } }` |
| `MODEL_TYPE_ENUM` | `const` | `{ chat: 'chat', embedding: 'embedding' } as const` |
| `ModelTypeFilter` | TypeScript `type` alias | `'chat' \| 'embedding'` |

`ParseEnumPipe` 는 `@nestjs/common` 에서 import 한 기존 프레임워크 식별자로, 이미 `auth.controller.ts` 에서도 동일하게 사용 중이다. 신규 도입이 아니므로 충돌 대상 외.

---

## 발견사항

### [INFO] `MODEL_TYPE_ENUM` 이 `MODEL_CONFIG_KINDS` 와 유사하나 범위가 다름

- **target 신규 식별자**: `MODEL_TYPE_ENUM` (`{ chat: 'chat', embedding: 'embedding' }`) — `llm-model-config.controller.ts` 파일-로컬
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/model-config/entities/model-config.entity.ts` — `MODEL_CONFIG_KINDS: readonly ModelConfigKind[] = ['chat', 'embedding', 'rerank']`
- **상세**: `MODEL_CONFIG_KINDS` 는 모델 설정의 전체 kind 집합(`chat | embedding | rerank`)이고, `MODEL_TYPE_ENUM` 은 `listModels` 쿼리 필터에서 허용하는 부분집합(`chat | embedding`)이다. `rerank` 는 provider 별 모델 목록 조회를 지원하지 않으므로 의도적 제외. 두 이름이 같은 파일에 있지 않고, 용도와 명칭 접미사(`_KINDS` vs `_ENUM`)도 다르므로 실질적 충돌 없음.
- **제안**: 현재 명명으로 충분. 필요 시 `MODEL_LIST_TYPE_ENUM` 으로 리네임해 `listModels` 전용 필터임을 더 명시적으로 표현할 수 있으나 필수 아님.

### [INFO] `ModelTypeFilter` 가 기존 인라인 타입과 의미적으로 동등

- **target 신규 식별자**: `ModelTypeFilter = 'chat' | 'embedding'` — `llm-model-config.controller.ts` 파일-로컬
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/llm/llm.service.ts` 337행: `opts?: { type?: 'chat' | 'embedding' }` (익명 인라인 타입)
  - `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts` 78행: `ModelInfo.type: 'chat' | 'embedding'` (ModelInfo 인터페이스 필드)
- **상세**: 세 곳 모두 `'chat' | 'embedding'` 을 표현하나 각자 독립 맥락(서비스 opts 파라미터, 인터페이스 필드, 컨트롤러 쿼리 타입)이다. `ModelTypeFilter` 는 `llm.service.ts` 의 익명 인라인 타입에 이름을 부여한 것으로 오히려 명확성 향상. `ModelConfigKind` (`'chat' | 'embedding' | 'rerank'`)와 혼동될 수 있으나 `Filter` 접미사와 파일-로컬 범위로 구분 가능.
- **제안**: 충돌 없음. 향후 서비스 레이어 `opts.type` 파라미터 타입을 이 `ModelTypeFilter` 로 통일하면 DRY 개선 가능 — 현 scope 외 선택사항.

### [INFO] `PROVIDER_PROBE_THROTTLE` 이 `INVITATION_THROTTLE` 과 동일 shape 의 별도 상수

- **target 신규 식별자**: `PROVIDER_PROBE_THROTTLE = { default: { ttl: 60_000, limit: 10 } }` — `llm-model-config.controller.ts` 파일-로컬
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `INVITATION_THROTTLE = { default: { ttl: 60_000, limit: 10 } }` (동일 값, 다른 파일)
- **상세**: 두 상수는 값이 같지만 다른 컨트롤러의 파일-로컬 상수이므로 이름 충돌이 없다. 값의 중복 자체는 설계 일관성(동일 provider probe / invite 속도제한 정책)을 반영한 것으로 볼 수 있다. 하나의 공유 상수로 추출하는 것은 선택사항이지만 파일-로컬 범위 원칙을 지키는 현 방식도 합당하다.
- **제안**: 충돌 없음. 공유 throttle 상수가 필요해지면 `shared/constants/throttle.ts` 등으로 분리 고려 가능 — 현 scope 외.

---

## 요약

이번 diff 가 도입하는 세 식별자(`PROVIDER_PROBE_THROTTLE`, `MODEL_TYPE_ENUM`, `ModelTypeFilter`) 는 모두 파일-로컬 모듈 스코프이며, 기존 코드베이스 어디서도 동일 이름이 다른 의미로 export 되거나 재사용되지 않는다. 유사 명칭(`MODEL_CONFIG_KINDS`, `ModelConfigKind`, `INVITATION_THROTTLE`)이 존재하지만 의미·범위·도메인이 구별되어 실질적 충돌로 이어지지 않는다. API endpoint·이벤트명·환경변수·파일 경로 수준의 신규 식별자는 없다. 요구사항 ID 신규 부여도 없다.

---

## 위험도

NONE
