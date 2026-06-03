# 요구사항(Requirement) Review — MakeShop Phase 0 Metadata Layer

## 발견사항

### **[INFO]** TODO 주석 — 타임존 미확인 (의도적 보류)
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` L1153–1155
- 상세: `// TODO(Phase 3 / makeshop-api-metadata §4): MakeShop timezone is unconfirmed` 주석이 존재한다. 이는 미완성 작업 시사 주석이지만, spec `makeshop-api-metadata.md §4` 에서 "timezone: 미확인 — 구현 시 확정" 으로 **명시적으로 보류**된 사항이므로 버그가 아니다. Phase 3 이전에는 타임존 접미사를 MCP description 에 붙이지 않는다는 의도가 정확히 코드화돼 있다.
- 제안: 그대로 유지. 다만 추적 가시성을 위해 plan 에 Phase 3 task 로 명시하는 것을 권장.

---

### **[WARNING]** cpik.md catalog 의 `post-cpik_member-check` / `post-cpik_member-login` scope 불일치 가능성
- 위치: `spec/conventions/makeshop-api-catalog/cpik.md` L2125, L2128; `codebase/.../cpik.ts` L949, L1040
- 상세: 카탈로그에서 두 operation 모두 `scope: write` 로 표시됐다. 그런데 `types.ts` 주석(L1819)은 "CPIK member check/login POSTs are read-style" 이라고 명시한다. 즉 구현자가 의미론적으로 이 두 operation 이 read에 가깝다고 판단했으나, catalog 과 metadata 모두 `write` 로 일치시킨 상태다. 이는 catalog-sync 테스트는 통과하지만, OAuth scope 관점에서 나중에 `write` 토큰을 요구하게 된다. 또한 types.ts 주석과 실제 catalog/metadata 값이 불일치한다 — 주석은 "read-style"이라 하고 코드는 `write`로 기록한다.
- 제안: `post-cpik_member-check` (연동 여부 "확인"), `post-cpik_member-login` (SSO 토큰 "획득")의 scopeType 을 `read` 로 변경할지 결정 필요. 의도적으로 `write`로 통일했다면 types.ts L1819 주석의 "read-style" 표현을 제거하거나 수정해야 한다. 판단이 모호하므로 WARNING으로 둠.

---

### **[INFO]** `MakeshopOperationMetadata.labelKey` 필드 부재 (public-meta 에서 생성)
- 위치: `codebase/.../types.ts`; `codebase/.../public-meta.ts` L1670
- 상세: spec `makeshop-api-metadata.md §2` 의 인터페이스 정의에 `labelKey` 필드가 없다. `public-meta.ts` 에서 `labelKey: \`makeshop.${resource}.${op.id}\`` 를 동적으로 생성한다. spec §2 의 주석 "사람 친화 라벨은 frontend i18n dict (`makeshop.<resource>.<operation>`) 로 lookup" 과 일치하므로 구현 방향은 올바르다. spec 에 `labelKey` 는 `PublicMakeshopOperation` 에 존재하는 파생 필드임이 명시되지 않아 누락처럼 보이지만, internal metadata type 에 없고 public projection 에서 생성하는 구조가 의도적이다.
- 제안: spec 갱신 없이도 기능상 문제 없음. 필요시 spec §2 에 "internal metadata 에는 labelKey 없음, public projection 에서 파생" 한 줄 추가 가능.

---

### **[INFO]** `[SPEC-DRIFT]` spec `makeshop-api-metadata.md §5` 표현 낡음
- 위치: `spec/conventions/makeshop-api-metadata.md` §5
- 상세: §5 본문은 "단 makeshop catalog 은 현재 status 컬럼이 없는 순수 레퍼런스이므로, 구현 착수 시 catalog 에 `status` 컬럼을 추가하고 sync 대상으로 승격한다"고 서술한다. 이번 PR 이 정확히 그 승격을 완료했으므로 §5 의 서술이 낡았다. 코드·catalog 변경은 합리적이고 의도적이다.
- 제안: 코드 유지 + spec 반영. `spec/conventions/makeshop-api-metadata.md §5` 본문을 "Phase 0 에서 완료됨 — catalog 에 `status`/`scope`/`paginated` 컬럼 추가, `catalog-sync.spec.ts` 양방향 동기 보호 도입" 으로 갱신 필요 (project-planner 위임).

---

### **[INFO]** `[SPEC-DRIFT]` spec `5-makeshop.md §2` (설정 UI) 표현 낡음
- 위치: `spec/4-nodes/4-integration/5-makeshop.md` §2 마지막 bullet
- 상세: "현재 MakeShop catalog 는 `status` 컬럼이 없는 순수 레퍼런스이므로, 구현 착수 시 catalog 에 `status` 컬럼을 도입한 뒤 적용한다" 라고 쓰여 있다. Phase 0 에서 status 컬럼이 도입됐으므로 낡은 서술이다.
- 제안: 코드 유지 + spec 반영. `spec/4-nodes/4-integration/5-makeshop.md §2` 해당 bullet 을 "Phase 0 에서 catalog 에 `status` 컬럼 도입 완료" 로 갱신 필요 (project-planner 위임).

---

### **[INFO]** `constraints` 필드 — 현재 모든 operation 에 선언 없음
- 위치: `codebase/.../types.ts` L1840 주석
- 상세: 주석에 "Empty for all rows today (no MakeShop op declares constraints yet) but the field exists for parity with Cafe24" 라고 명시됐다. 실제로 7개 섹션 파일 어디에도 `constraints` 선언이 없다. 향후 사용을 위한 scaffolding으로 기능상 문제 없다.
- 제안: 현재 상태 유지. 첫 번째 constraint 추가 PR 시 metadata.spec.ts 의 constraints 검증 테스트가 자동으로 적용된다.

---

### **[INFO]** `catalog-sync.spec.ts` — `cells.length < REST_HEADERS.length` 조건이 열 수 부족 행을 조용히 skip
- 위치: `codebase/.../catalog-sync.spec.ts` L542
- 상세: `if (cells.length < REST_HEADERS.length) continue;` 는 열 수가 8 미만인 data 행을 오류 없이 건너뛴다. 유효하지 않은 catalog 행이 소리 없이 무시될 수 있다. 현재 catalog 파일은 정규화돼 있으므로 즉각적인 위험은 없지만, 나중에 잘못된 행이 추가될 경우 테스트가 통과하면서 sync 보장이 깨질 수 있다.
- 제안: INFO 수준. 향후 `throw new Error(...)` 로 강화 가능.

---

### **[INFO]** `get-cart_free_config-update` — GET 으로 상태 변경 (spec 침묵)
- 위치: `spec/conventions/makeshop-api-catalog/shop.md` L2537; `codebase/.../shop.ts` (미노출된 diff)
- 상세: `get-cart_free_config-update` 의 method 가 GET 이고 path 도 `cart_free_config/update` 이다. MakeShop 공식 API 가 GET 으로 카트프리 설정 변경을 구현한 외부 API 설계상의 이상함이다. 이는 MakeShop API 자체의 설계이며, 본 메타데이터는 공식 API 를 그대로 반영한다. scopeType 이 `read` 로 지정돼 있어 GET 메서드와 일치하지만 사실상 write 동작이다. 그러나 MakeShop OAuth scope 체계에서 이 operation 의 실제 scope 요구사항은 미확인이다.
- 제안: 공식 API 동작을 그대로 반영한 것이므로 현재 구현 유지. 구현 Phase(Phase 2)에서 실제 OAuth 호출 테스트 시 scope 재확인 필요.

---

## 요약

Phase 0 의도 — 7개 섹션 161 REST operation 메타데이터 레이어 신설 + catalog ↔ metadata 양방향 sync 테스트 도입 + catalog MD 파일 승격 — 을 코드가 **완전히 구현**한다. `types.ts` 인터페이스는 spec `makeshop-api-metadata.md §2` 와 line-level 로 일치하며, `restrictedApproval` 부재·GET/POST 전용·constraints 형식도 spec 명세와 정확히 대응한다. `catalog-sync.spec.ts` 의 6종 검증(구조·형식·양방향 동기)은 spec §5 에서 요구하는 sync 보호를 충실히 구현한다. 주요 기능적 위험은 없다. `cpik.md` 의 check/login scope `write` 지정과 `types.ts` 주석 불일치(WARNING) 는 향후 OAuth 구현 Phase 에서 재검토가 필요하다. spec 두 곳(makeshop-api-metadata §5, 5-makeshop.md §2 bullet)이 Phase 0 완료로 낡아진 서술을 담고 있어 project-planner 에 의한 갱신이 필요하다.

## 위험도

LOW
