# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=37230c91f)

diff-base 대비 실제 변경 대상:
- `spec/5-system/17-agent-memory.md` §6 — `DELETE /agent-memories?scopeKey=` 에 `X-Deleted-Count` 응답 헤더 추가
- `spec/2-navigation/16-agent-memory.md` §2 — 0건 시 중립 토스트 UX 행동 추가
- `codebase/backend/src/main.ts` — CORS `exposedHeaders: ['X-Deleted-Count']` 추가
- `codebase/backend/src/common/cors/web-chat-cors.ts` — `exposedHeaders?` 필드 추가

---

## 발견사항

### [INFO] `X-Deleted-Count` 헤더 결정이 `## Rationale` 섹션 대신 본문 인라인에만 서술됨
- target 위치: `spec/5-system/17-agent-memory.md` §6 (bullet "삭제 건수 echo (`X-Deleted-Count`)")
- 과거 결정 출처: 프로젝트 전반 spec 관례 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"(CLAUDE.md §정보 저장 위치)
- 상세: `X-Deleted-Count` 를 204 본문 없는 삭제 응답에 사용하는 패턴은 이 프로젝트에 처음 등장하는 API 컨벤션(기존 `spec/5-system/2-api-convention.md` §5~§6 은 응답 body 형식만 정의하고 커스텀 응답 헤더 정책을 정의한 항목이 없음). 이유(204 에 body 없음 → 헤더로 count 운반 → 0건 UX 분기)는 §6 bullet 인라인에 적혀 있으나, `## Rationale` 섹션에 대응 항목이 없어 탐색하기 어렵다. 기각된 대안(응답 body 반환 → HTTP 시맨틱 위반 / 200+body → 멱등 delete 의미 훼손 등)도 기록되어 있지 않다.
- 제안: `spec/5-system/17-agent-memory.md` 의 `## Rationale` 섹션에 "삭제 건수 반환 — `X-Deleted-Count` 헤더 채택" 항목을 추가하고, (a) 왜 body 대신 헤더인지, (b) 기각 대안(200+body, 별도 GET 재조회 등)을 기술한다. 동시에 이 컨벤션을 향후 다른 멱등 DELETE 에도 적용할 의도가 있는지 여부를 명시한다.

---

## 요약

diff-base(`37230c91f`)에서 HEAD(`de8ebff3c`)까지의 spec 변경은 `spec/5-system/17-agent-memory.md` §6 과 `spec/2-navigation/16-agent-memory.md` §2 에서 scope 전체 삭제의 `X-Deleted-Count` 응답 헤더를 추가한 것이 전부다. 기존 Rationale 에서 명시적으로 기각된 대안(별도 벡터DB, KB 식 일괄 재임베딩 등)을 재도입하거나, 합의된 설계 원칙(hard delete 비가역성, workspace_id 격리 강제, editor+ 삭제 권한, scope 단위 직렬화)을 위반하는 결정은 없다. 유일한 지적 사항은 이 새로운 API 컨벤션(204 + 커스텀 헤더)의 선택 근거와 기각 대안이 본문 인라인에만 기술되고 `## Rationale` 섹션에 공식 등재되지 않아, 프로젝트 관례상의 단일 진실 위치 기준을 완전히 충족하지 못한다는 INFO 수준의 관찰이다.

## 위험도

LOW
