## 발견사항

### INFO-1 — `spec-update-cafe24-pending-polish.md` 위임 문서가 목록에 미노출
- **target 위치**: 서두 "본 draft 는 `plan/in-progress/spec-update-cafe24-pending-polish.md` 의 위임 요구를 spec 본문 패치 형태로 구체화한다"
- **관련 plan**: 제공된 in-progress 목록에 `spec-update-cafe24-pending-polish.md` 가 없음 (목록 끝 truncation 으로 인해 실제 존재 여부 불확실)
- **상세**: target draft 가 근거로 삼는 위임 문서의 존재 확인 불가. `cafe24-pending-polish.md` 본문에도 해당 파일명이 직접 언급됨 — 있다면 정상, 없다면 위임 출처 불명.
- **제안**: 해당 파일 존재 여부를 확인 후, 없으면 target draft 의 서두를 `cafe24-pending-polish.md §Consistency-check 결과` 로 직접 참조하도록 수정.

---

### INFO-2 — legacy path 영구 폐기 후속 항목이 `cafe24-pending-polish.md` 에 미반영
- **target 위치**: DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격" 절 — "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가 (운영 데이터·외부 등록 URL 잔존 여부 확인 후 결정)"
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` — 비포함 섹션·후속 항목 없음
- **상세**: spec draft 가 "후속 항목 추가"를 요구하지만 대상 plan 문서에 해당 체크박스나 섹션이 현재 없음. draft 통과 후 plan 갱신 없이 넘어가면 legacy path (`/oauth/install/cafe24`) 의 `410 Gone` 영구 제거 시점이 추적 불가 상태로 남음.
- **제안**: consistency-check 통과 후 spec 적용 시, `cafe24-pending-polish.md` 에 `[ ] legacy install 경로 (`/oauth/install/cafe24`) 영구 제거 — 운영 데이터 잔존 URL 확인 후 별도 PR` 체크박스를 추가.

---

### INFO-3 — `node-output-redesign` plan 과의 `spec/4-nodes/4-integration/4-cafe24.md` 접근 교차 확인
- **target 위치**: DRAFT 2J — `spec/4-nodes/4-integration/4-cafe24.md` §9.4·§9.8·§337·§10 수정
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` — Integration 노드 3종(HTTP Request / Database Query / Send Email) 만 열거. Cafe24 노드(`4-cafe24.md`)는 목록에 없음
- **상세**: 두 plan 이 다른 노드를 대상으로 하므로 실질적 worktree 경합 없음. 다만 node-output-redesign README 가 truncated 되어 Cafe24 가 포함됐는지 완전 확인 불가.
- **제안**: node-output-redesign README 의 전체 노드 목록을 한 번 확인해 Cafe24 노드 포함 여부를 검증하면 충분. 미포함이 확인되면 이 INFO 는 닫힘.

---

## 요약

target draft 는 `cafe24-pending-polish` worktree 안에서 일관되게 작성됐으며, `cafe24-pending-polish.md` 의 실행 순서 "step 0 — BLOCK 해소" 를 정확히 이행한다. 미해결 결정(install_token 승격·callback 실패 시 status 보존·TTL 24h expired 전이)을 모두 명문화하고 있고, 다른 in-progress plan 들과 동일 spec 파일을 동시에 수정하는 경합도 검출되지 않는다. 발견된 항목은 모두 INFO 등급의 추적 보완이며, draft 적용을 차단할 이유는 없다.

## 위험도

**LOW**