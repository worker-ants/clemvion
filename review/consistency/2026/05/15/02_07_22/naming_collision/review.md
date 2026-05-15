## 명명 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-3rdparty-url.md`
검토 모드: `--spec`

---

### 발견사항

#### [WARNING] `google` / `github` provider 식별자가 두 namespace 에서 동일하게 사용됨

- **target 신규 식별자**: `/api/3rd-party/google/callback`, `/api/3rd-party/github/callback` 내 `google` · `github`
- **기존 사용처**: `spec/2-navigation/10-auth-flow.md` §8 — `GET /api/auth/oauth/:provider/callback` 의 `:provider` 값으로 동일한 `google` · `github` 사용 중
- **상세**: 기존 social login 콜백(`/api/auth/oauth/google/callback`)과 신규 integration 콜백(`/api/3rd-party/google/callback`)이 동일한 `provider` 토큰 값을 서로 다른 prefix 에서 공유한다. 경로 자체는 충돌하지 않으나, 운영 시 Google Cloud Console / GitHub OAuth App 에 redirect URI 를 **두 개** 모두 등록해야 한다는 사실이 spec 어디에도 명시되지 않았다. 배포 체크리스트(`Phase 2 §OAuth 콘솔 재등록`)가 social login URI 를 덮어쓰거나 누락하는 운영 사고가 발생할 수 있다.
- **제안**: spec draft Rationale 과 Phase 2 체크리스트에 "기존 social login redirect URI(`/api/auth/oauth/google/callback`, `/api/auth/oauth/github/callback`)는 유지하고 integration redirect URI 를 **추가** 등록한다"를 명시.

---

#### [WARNING] callback 경로가 spec 내에서 파라메트릭 형식과 명시적 형식으로 혼재

- **target 신규 식별자**: `GET /api/3rd-party/:provider/callback` (§9.2 · §10.1 변경 내역) vs. `GET /api/3rd-party/cafe24/callback`, `GET /api/3rd-party/google/callback`, `GET /api/3rd-party/github/callback` (결정 사항 표 · Rationale)
- **기존 사용처**: 없음 (신규 namespace). 내부 일관성 문제.
- **상세**: spec draft 의 "결정 사항" 표와 Rationale 에서는 provider 별 명시적 경로 3개를 열거하는 반면, `spec/2-navigation/4-integration.md` §9.2 API 표와 §10.1 변경 내역에서는 파라메트릭 형식(`/api/3rd-party/:provider/callback`)을 사용한다. 구현 시 단일 파라메트릭 핸들러를 만들지, provider 별 컨트롤러 3개를 만들지가 spec 에서 결정되지 않았다. Phase 2 "결정 보류 항목"에 이미 언급되어 있으나 spec 본문에 반영되지 않아 spec → 구현 간 불일치 소지가 있다.
- **제안**: spec 본문을 파라메트릭(`/api/3rd-party/:provider/callback`, `:provider ∈ {cafe24, google, github}`) 단일 형식으로 통일하거나, provider-grouped 명시적 경로 3개 형식으로 통일한다. 어느 쪽이든 API 표와 Rationale 이 동일한 형식을 사용하도록 정리 후 spec 반영.

---

#### [INFO] `spec/conventions/` 라우팅 namespace 규약 미결

- **target 신규 식별자**: `/api/3rd-party/<provider>/` namespace
- **기존 사용처**: `spec/conventions/` 에 라우팅 prefix 규약 문서 없음
- **상세**: spec draft 는 "검토 필요 — 새 conventions 파일을 만들지, 기존 routing convention 에 흡수할지"로 결정을 유보했다. 현재 `spec/conventions/cafe24-api-metadata.md`·`migrations.md`·`node-output.md`·`swagger.md` 에 라우팅 prefix 규칙은 없다. 규약 없이 구현하면 향후 Cafe24 webhook 수신기(`/api/3rd-party/cafe24/webhook`) 등을 추가할 때 일관성 판단 근거가 없어진다.
- **제안**: spec 반영 전 또는 Phase 2 착수 전에 라우팅 namespace 규약 결정을 `spec/conventions/` 에 한 줄이라도 명시한다.

---

#### [INFO] V047 마이그레이션 번호 충돌 가능성 (확인 필요)

- **target 신규 식별자**: `V047` (application-level format change 기록용)
- **기존 사용처**: `plan/in-progress/cafe24-data-model-strengthen.md` — V044·V045·V046 이 `[x]` 완료 처리됨. 다음 번호는 V047.
- **상세**: spec draft 가 V047 을 사용한다고 가정하나, `spec/conventions/migrations.md` §5의 절차 ("머지 직전 `ls backend/migrations | tail -2` 로 max V 확인")를 아직 수행하지 않은 상태. 병렬 진행 중인 다른 worktree 에서 V047 을 선점했을 경우 충돌 발생.
- **제안**: Phase 2 착수 시 `ls backend/migrations | tail -2` 로 실제 max V 를 확인 후 번호 확정.

---

### 요약

신규 `/api/3rd-party/<provider>/` namespace 자체는 기존 어떤 spec 식별자와도 직접 충돌하지 않는다. 그러나 `google` · `github` provider 토큰 값이 social login(`/api/auth/oauth/`)과 integration(`/api/3rd-party/`) 양쪽에서 동일하게 사용되는 점이 운영 시 OAuth 콘솔 설정 누락으로 이어질 수 있고, spec 내 callback 경로 표기 방식(파라메트릭 vs. 명시적)이 혼재하여 구현 착수 전 정리가 필요하다.

### 위험도

**LOW** — Critical 충돌 없음. Warning 2건은 spec 본문 일관성 보정과 운영 절차 명시로 해소 가능.