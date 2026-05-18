# 신규 식별자 충돌 검토 — spec/2-navigation/4-integration.md

> 검토 모드: 구현 착수 전 검토 (--impl-prep)
> Target: `spec/2-navigation/4-integration.md` 에 제안된 변경 (`plan/in-progress/spec-update-cafe24-jwt-exp.md`)
> 검토 일시: 2026-05-18

---

## 발견사항

### [INFO] `parseJwtExp` 함수명과 기존 `parseTokenExpiresAt` 의 역할 경계
- **target 신규 식별자**: `parseJwtExp(token)` — `codebase/backend/src/modules/integrations/jwt-exp.ts` 에 신규 생성 예정. spec §10.5 bullet 및 §5.8 "응답 shape" 설명에서 참조됨.
- **기존 사용처**: `parseTokenExpiresAt(provider, data)` — `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1679`. spec §5.8 및 cafe24-api.client.ts:555 주석에서 이미 참조됨.
- **상세**: 두 함수가 동시에 존재하게 되며 각자의 역할이 다르다 (`parseJwtExp` = JWT payload 디코딩 전용, `parseTokenExpiresAt` = provider별 분기 파싱 wrapper). 충돌은 아니지만 spec 본문이 `parseJwtExp` 와 `parseTokenExpiresAt` 를 모두 언급하게 되면, 독자가 둘의 관계 (전자가 후자의 내부 첫 단계로 호출됨) 를 명확히 이해하도록 한 곳에서 설명해야 한다. `spec-update-cafe24-jwt-exp.md §1` 의 새 bullet 은 `parseJwtExp(token)` 를 최우선 채택하는 normalizer 의 외부 인터페이스로만 설명하고, 두 함수의 계층 관계를 직접 서술하지 않는다.
- **제안**: spec §10.5 신설 bullet 에 "token-exchange normalizer(`parseTokenExpiresAt`) 는 내부적으로 `parseJwtExp` 를 첫 단계로 호출한다" 는 1문장을 추가해 계층 관계를 명시한다. 충돌 자체는 없으므로 비차단.

---

### [INFO] `Cafe24RefreshJobData.source` 유니온에 `'reactive_401'` 추가 — 기존 값과의 명명 일관성
- **target 신규 식별자**: `'reactive_401'` — `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts:60` 의 `source` 유니온 확장 예정. spec §Rationale 신규 항에서 이 값을 명시적으로 참조.
- **기존 사용처**: `'proactive' | 'background'` — 동일 파일 line 60. 기존 두 값은 한국어 설명에서 각각 "API 호출 직전 lazy", "일일 스캐너" 를 의미하며, 영문 동사적 형용사 형태.
- **상세**: `'reactive_401'` 는 기존 두 값과 명명 패턴이 다르다. `'proactive'` / `'background'` 는 동작의 성격(선제적 / 백그라운드)을 나타내는 단어인 반면, `'reactive_401'` 은 구체적 HTTP 상태코드를 suffix 로 포함한다. 이는 식별자 충돌이 아니라 naming convention 일관성 문제이며, 향후 다른 reactive 경로(예: `'reactive_429'`, `'reactive_403'`)가 추가될 경우 확장 방향을 예단한다. 현재 사용 범위는 Cafe24 전용이고 코드베이스 검색 결과 기존 충돌 없음.
- **제안**: 명명 자체는 의도와 구현을 명확히 드러내 혼동 위험이 낮으므로 그대로 진행해도 무방하다. 단, spec §Rationale 신규 항 또는 constants 파일 JSDoc 에 `'reactive_401'` 이 "HTTP 401 을 empirical 하게 받은 경로에서의 강제 refresh" 를 의미하며, 향후 확장 시 `'reactive_<status>'` 패턴이나 별도 플래그(`forceRefresh: boolean`)로 대체할 수 있음을 1문장으로 명시하면 후속 구현자에게 도움이 된다.

---

### [INFO] Rationale 신규 항 제목 "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 과 기존 항 제목 유사성
- **target 신규 식별자**: `### Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)` — spec `## Rationale` 내 신규 섹션 헤딩.
- **기존 사용처**: `### Cafe24 token 응답의 \`expires_at\` 처리 (2026-05-17)` — `spec/2-navigation/4-integration.md:1373`. 두 항 모두 Cafe24 token 만료 시각 파싱을 주제로 하며, 신규 항의 제안이 "옛 항을 흡수한다" 고 명시(`spec-update-cafe24-jwt-exp.md §2` 마지막 문장).
- **상세**: 두 Rationale 헤딩이 동시에 존재하면 Markdown 앵커가 다르므로 충돌은 없다 (`#cafe24-token-응답의-expires_at-처리-2026-05-17` vs `#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18`). 그러나 제안 노트가 "옛 항은 본 격상으로 흡수" 라고 서술하면서 정작 옛 항을 물리적으로 제거하거나 obsolete 처리하는 지침이 `spec-update-cafe24-jwt-exp.md` 에 명시되어 있지 않다. spec 에 두 항이 공존하면 이전 결정과 새 결정이 병존해 독자가 어느 것이 현행인지 혼동할 수 있다.
- **제안**: `spec-update-cafe24-jwt-exp.md §3` (신규 Rationale 항) 의 작업 지침에 "옛 '`Cafe24 token 응답의 \`expires_at\` 처리 (2026-05-17)`' 항 상단에 `> **이하 내용은 2026-05-18 "JWT exp 격상" 항으로 흡수·갱신됨.**` deprecated 주석을 추가하거나 해당 항을 삭제" 를 명시한다. 충돌 자체는 없으므로 비차단.

---

### [INFO] spec §5.8 "응답 shape (Cafe24 quirk)" 링크 앵커 갱신 필요
- **target 신규 식별자**: 수정 제안(spec §5.8, line ~555)에서 Rationale 링크가 `[Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)"](#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18)` 으로 변경된다.
- **기존 사용처**: 현재 line 555 에서 `([Rationale "Cafe24 token 응답의 \`expires_at\` 처리"](#cafe24-token-응답의-expires_at-처리-2026-05-17))` 링크가 존재.
- **상세**: spec-update 제안이 §5.8 본문 링크를 새 Rationale 항으로 바꾸는 내용을 포함하므로, 앵커 ID 가 새 헤딩의 GFM slug 와 정확히 일치하는지 사전 확인이 필요하다. 제안된 앵커 `#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18` 는 헤딩 "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 의 GFM slug (소문자화 + 특수문자 처리) 와 일치 여부 점검 대상이다. "—" (em dash)는 GFM 에서 하이픈으로 변환되지 않고 제거될 수 있어 실제 slug 는 `#cafe24-token-만료-sot-jwt-exp-격상-2026-05-18` 가 될 수 있다. 유사한 앵커 깨짐 이슈가 C-15 (`spec/conventions/cafe24-api-metadata.md#6` → `#7`) 와 C-14 (`0-common.md#11` → `#10`) 에서 이미 발견·수정됐다.
- **제안**: spec PR 작성 전 `spec-update-cafe24-jwt-exp.md §2` 의 링크 앵커를 실제 렌더링된 헤딩으로 검증한다. 앵커 불일치면 깨진 내부 링크가 생긴다.

---

## 요약

`spec/2-navigation/4-integration.md` 에 제안된 변경(Cafe24 JWT exp 기반 만료 SoT 격상 + `reactive_401` source 값 추가)은 기존 식별자와의 직접 충돌이 없다. `parseJwtExp` 는 완전히 새로운 헬퍼로 기존 `parseTokenExpiresAt` 와 다른 이름·책임을 가지며, `'reactive_401'` 은 `Cafe24RefreshJobData.source` 유니온의 신규 값으로 기존 `'proactive'` / `'background'` 와 겹치지 않는다. 새 Rationale 헤딩은 기존 관련 항과 앵커 slug 가 다르므로 충돌이 없다. 다만 (a) `parseJwtExp`–`parseTokenExpiresAt` 계층 관계 미명시, (b) `'reactive_401'` 명명 일관성 이슈, (c) 기존 흡수 대상 Rationale 항의 obsolete 처리 미지정, (d) 신규 Rationale 앵커 slug 깨짐 가능성 등 4건의 INFO 수준 보완 사항이 확인되었다. 모두 비차단이며 spec PR 작성 시 함께 정리 가능하다.

## 위험도

LOW
