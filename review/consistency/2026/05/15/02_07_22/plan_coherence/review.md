---

## 발견사항

### [WARNING] V047 마이그레이션 entry 포함 여부 — 동일 worktree 내 양 plan 간 직접 충돌

- **target 위치**: `spec-draft-cafe24-3rdparty-url.md` → "영향받는 spec 파일" → spec/1-data-model.md 섹션 마지막 줄
  > ※ 마이그레이션 신규 entry 추가 안 함 — DB schema 무변경, application-level format 만 변경. Rationale 에 명시.
- **관련 plan**: `cafe24-app-url-3rdparty-shorten.md` Phase 1, spec/1-data-model.md 세 번째 bullet
  > V044 (install_token_issued_at) 는 그대로, 토큰 형식 변경은 **V047 으로 신규 마이그레이션 entry 추가** (DB 컬럼 길이 제약은 없으므로 schema 변경 없이 application-level format 만 변경 — V047 은 "format change documented" 의미로 기록)
- **상세**: 두 문서가 동일 worktree(`cafe24-3rdparty-url-503aa0`) 안에 있음에도 마이그레이션 추가 여부가 정반대로 기술돼 있다. developer 가 Phase 2 착수 시 어느 쪽을 따라야 할지 모호하다.
- **제안**: spec draft 가 공식 결정 문서이므로 구현 plan의 해당 bullet을 spec draft 방향(추가 안 함)으로 수정하거나, V047 "format change documented" entry 를 남기기로 확정했다면 spec draft 의 Rationale 에 그 근거를 명시하고 "마이그레이션 신규 entry 추가 안 함" 문장을 수정해야 한다. 둘 중 하나로 맞추지 않으면 developer 가 Phase 2 진입 시 자의적 결정을 내리게 된다.

---

### [WARNING] `spec/conventions/` namespace 룰 — spec draft 의 범위에서 누락

- **target 위치**: `spec-draft-cafe24-3rdparty-url.md` → "미수정 (영향 없음 확인)" 섹션
  > `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/swagger.md` — 라우트 prefix 직접 참조 없음.
- **관련 plan**: `cafe24-app-url-3rdparty-shorten.md` Phase 1 마지막 bullet
  > `spec/conventions/` 신규 또는 기존 문서에 `/api/3rd-party/<provider>/` namespace 룰 명시 (검토 필요 — 새 conventions 파일을 만들지, 기존 routing convention 에 흡수할지)
- **상세**: 구현 plan 의 Phase 1 은 project-planner 담당이며 conventions 파일 갱신을 명시적 체크박스로 두고 있다. 그런데 spec draft 는 "기존 conventions 파일 직접 참조 없음"으로만 끝내고 신규 생성 여부를 전혀 다루지 않는다. spec draft 가 Phase 1 의 완결 산출물로 쓰이려면 이 결정이 포함돼야 한다.
- **제안**: spec draft 에 다음 중 하나를 명시한다. (a) 신규 `spec/conventions/routing-namespaces.md` (또는 유사 이름) 파일 생성 + `/api/3rd-party/<provider>/` prefix 규약 기술, (b) 기존 conventions 파일에 흡수 결정 + 대상 파일 명시, (c) conventions 갱신 불필요 + 이유(현재 규약 문서가 path prefix 를 다루지 않는 범위라는 근거). 결정을 spec draft 에 박아야 구현 plan Phase 1 체크박스를 닫을 수 있다.

---

### [WARNING] 레거시 410 Gone 경로 (`/oauth/install/cafe24`, 토큰 없음) 의 처리 불명확 + 기존 등록자 안내 가이드 누락

- **target 위치**: `spec-draft-cafe24-3rdparty-url.md` → "결정 사항" 표
  > 옛 경로 | 즉시 제거 (`/api/integrations/oauth/{install,callback}/...` 핸들러 삭제)
- **관련 plan**: `cafe24-pending-polish-followup.md` Group A 항목 1 (아직 미체크)
  > [ ] **레거시 `/oauth/install/cafe24` 영구 폐기 시점 결정.** 운영 데이터·외부 Cafe24 Developers 등록 URL 잔존 여부 확인 후, 410 Gone 라우트 자체를 제거하거나 더 명확한 hint 로 강화. **기존 Private 앱 등록자 대상 App URL 재등록 안내 가이드 작성** (sales / docs 채널) 도 함께.
- **상세**: PR #18 의 변경 2는 "토큰 없는 `/oauth/install/cafe24`" 에 410 Gone 응답을 달고 "영구 폐기 시점은 운영 데이터 확인 후 별도 PR"로 미뤘다. 이 결정이 followup plan Group A 에 열린 항목으로 남아 있다. spec draft 의 "즉시 제거 (`/api/integrations/oauth/{install,callback}/...`)" 표기는 `{install}` 이 토큰 포함 경로(`/install/cafe24/:installToken`)를 가리키는지, 토큰 없는 레거시 경로(`/install/cafe24`)도 포함하는지 구분되지 않는다. 구현 plan Phase 2 는 "옛 `@Get('oauth/install/cafe24/:installToken')`, `@Get('oauth/callback/:provider')` 핸들러 삭제"라고 토큰 포함 경로만 적시해 실질적으로 토큰 없는 레거시 경로(410 Gone 핸들러)를 삭제 대상으로 보지 않는 것처럼 보인다. 또한 "기존 Private 앱 등록자 대상 App URL 재등록 안내 가이드" 는 spec draft 에서 전혀 언급되지 않는다.
- **제안**: spec draft 결정 표와 Rationale 에 레거시 경로(410 Gone, 토큰 없음) 처리 방침을 명시적으로 기술한다. "즉시 제거 대상은 토큰 포함 경로에 한정하며, 레거시 410 Gone 핸들러는 followup plan Group A 에 위임한다"라고 선을 그으면 충분하다. 함께 "기존 등록자 App URL 재등록 안내 가이드"는 spec 범위 밖이나 필수 운영 작업임을 Rationale 또는 구현 plan 체크리스트에 명시해야 한다.

---

### [INFO] followup Group D — `CAFE24_INSTALL_LEGACY_PATH(410)` swagger 문서화 항목의 유효성

- **target 위치**: 해당 없음 (spec draft 에서 직접 다루지 않는 항목)
- **관련 plan**: `cafe24-pending-polish-followup.md` Group D
  > [ ] 신규 에러 코드 3종 `@ApiResponse` 데코레이터 — `CAFE24_INSTALL_LEGACY_PATH(410)` 포함
- **상세**: 위 Warning 3 이 해결되어 레거시 410 Gone 핸들러의 존속/제거 방침이 확정될 때 이 항목의 유효성도 함께 재평가해야 한다. 핸들러가 제거되면 swagger 문서화 필요가 사라진다.
- **제안**: Warning 3 해결 후 이 항목을 닫거나 수정한다.

---

## 요약

spec draft 자체의 기술 내용(URL 구조·토큰 형식·길이 계산·Rationale)은 사용자 합의와 일치하며, 동일 worktree 의 구현 plan과 방향도 맞다. 그러나 세 가지 정합성 gap 이 있다: (1) V047 마이그레이션 entry 포함 여부가 양 plan 간 정반대로 기술되어 developer 가 Phase 2 착수 시 자의적 판단을 내려야 하는 상황, (2) spec/conventions/ namespace 규약 갱신 결정이 spec draft 에서 누락되어 Phase 1 체크박스가 완결되지 않은 상태, (3) 레거시 410 Gone 핸들러와 기존 등록자 안내 가이드 처리 방침이 spec draft 에서 명시되지 않아 followup plan Group A 의 미결 항목과 경계가 모호함. 이 세 가지를 spec draft 또는 구현 plan 에서 정리한 뒤 spec 본문에 반영하는 것이 바람직하다.

## 위험도

**MEDIUM** — Critical 위배는 없으나, V047 충돌과 conventions 누락 두 항목은 developer Phase 2 착수 직전 consistency-checker(`--impl-prep`) 에서 재차 걸릴 가능성이 높다. spec 본문 반영 전에 해소할 것을 권고한다.