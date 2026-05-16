# 의존성(Dependency) 리뷰

리뷰 대상: `review/consistency/2026/05/16/14_28_20/` 산출물 파일들 + `spec/1-data-model.md` 변경

---

## 발견사항

- **[INFO]** 이번 변경에 외부 패키지·라이브러리 의존성 추가 없음
  - 위치: 모든 변경 파일 (`review/consistency/**/*.md`, `review/consistency/**/meta.json`, `spec/1-data-model.md`)
  - 상세: 변경된 파일 6개는 consistency-checker 세션 산출물 파일(markdown, json)과 spec 문서 수정으로 구성된다. `package.json`, `package-lock.json`, `requirements.txt` 등 의존성 선언 파일은 전혀 포함되지 않았다. 새 외부 npm 패키지·라이브러리 추가가 없으므로 버전 고정, 라이선스 호환성, 취약점, 번들 크기 영향 관점의 검토 항목은 해당 없다.
  - 제안: 해당 없음.

- **[WARNING]** `spec/1-data-model.md` §2.10 Integration — `install_token` 라이프사이클 변경으로 내부 의존 관계에 비동기 업데이트 발생
  - 위치: `spec/1-data-model.md` §2.10 Integration 테이블 `install_token` 행 (변경 전: "callback 성공 시 보존, 24h TTL 만료 시에만 NULL/소거" → 변경 후: "callback 성공 또는 TTL 만료 시 NULL")
  - 상세: `install_token` 의 라이프사이클이 "callback 성공 시 보존" 에서 "callback 성공 시 NULL" 로 역전되었다. 이 컬럼을 읽는 내부 의존 모듈들 — `spec/2-navigation/4-integration.md` §9.2 API, `spec/data-flow/5-integration.md` 시퀀스 다이어그램, `backend/src/modules/integrations/integration-oauth.service.ts` 의 callback 처리 로직 — 이 아직 이전 스펙("callback 성공 시 보존")을 전제로 기술·구현되어 있을 경우 DB 상태와 코드 동작이 불일치한다. cross_spec 체커에서 `appUrl` 관련 `spec/2-navigation/4-integration.md` §9.1 제거가 CRITICAL 로 감지되었는데, `install_token` 라이프사이클 변경도 같은 파일의 §9.2 API 정의와 직접 연동된다.
  - 제안: `spec/2-navigation/4-integration.md` §9.2 및 Rationale "install_token TTL 24h" 항이 변경된 라이프사이클("callback 성공 시 NULL")을 반영하도록 동시에 갱신했는지 확인한다. 반영되지 않았다면 `backend` callback 처리 코드가 구 스펙 기준으로 `install_token` 을 보존할 수 있어 data-model 과 실제 DB 상태 간 불일치가 발생한다. `install_token_issued_at` 도 같은 변경("callback 성공 시 보존" → "callback 성공 시 NULL")을 받았으므로 스캐너(`pending-install-ttl` job)가 callback 성공 후 NULL 된 `install_token_issued_at` 을 fallback `created_at` 으로 처리하지 않도록 경계 조건을 재검토해야 한다.

- **[INFO]** `review/consistency/2026/05/16/14_28_20/meta.json` — newline 없이 파일 종료 (no trailing newline)
  - 위치: `review/consistency/2026/05/16/14_28_20/meta.json` (diff 내 `\ No newline at end of file`)
  - 상세: JSON 파일이 개행 문자 없이 종료된다. 기능 오동작을 일으키지는 않으나, 일부 파서와 `cat`-concatenation 기반 스크립트에서 경계 탐지 오류가 발생할 수 있고, git diff 가독성이 낮아진다. 프로젝트 내 다른 json 파일이 trailing newline 을 유지하는지 확인 후 일관성을 맞추면 좋다.
  - 제안: `meta.json` 파일 끝에 개행 문자를 추가한다. orchestrator 가 파일을 생성할 때 trailing newline 을 포함하도록 수정하면 이후 세션에서 동일 문제가 반복되지 않는다.

- **[INFO]** 내부 모듈 의존 관계 — `spec/1-data-model.md` 변경이 파생하는 다운스트림 spec 동기화 필요
  - 위치: `spec/1-data-model.md` §2.10 Integration `install_token` / `install_token_issued_at` 설명 변경
  - 상세: `spec/1-data-model.md` 는 단일 진실(SoT)로서 다음 문서들이 이를 참조한다: `spec/2-navigation/4-integration.md` §6(상태 전이), §9.2(API), Rationale "install_token TTL 24h"; `spec/data-flow/5-integration.md` 시퀀스 다이어그램; `spec/4-nodes/4-integration/4-cafe24.md` §9. `install_token` 라이프사이클 설명 변경이 참조 문서들과 동기화되지 않으면 각 문서가 독자적 진실을 가지는 상태가 되어 단일 진실 원칙이 훼손된다. cross_spec 체커가 이미 `appUrl` 삭제와 관련해 `spec/data-flow/5-integration.md` 동기화 점검을 권고했으며, `install_token` 변경도 같은 파일에 영향을 미친다.
  - 제안: `spec/1-data-model.md` 에서 `install_token` / `install_token_issued_at` 라이프사이클 변경이 발생했음을 참조 spec 문서 목록과 함께 plan 에 기재하고, project-planner 가 참조 문서들을 일괄 갱신하도록 위임한다.

---

## 요약

이번 변경 세트는 consistency-checker 세션 산출물(markdown 리뷰 파일 5개 + meta.json)과 `spec/1-data-model.md` 의 Integration 엔티티 필드 설명 수정으로 구성된다. 외부 패키지·라이브러리 추가는 전혀 없어 버전 고정·라이선스·취약점·번들 크기 관점의 의존성 문제는 발생하지 않는다. 의존성 관점에서 주목해야 할 사안은 내부 모듈 간 의존 관계로, `spec/1-data-model.md` 에서 `install_token` 라이프사이클이 "callback 성공 시 보존" 에서 "callback 성공 시 NULL" 로 변경되었으나 이를 참조하는 `spec/2-navigation/4-integration.md` §9.2, `spec/data-flow/5-integration.md`, backend callback 처리 코드가 아직 이전 스펙을 전제로 남아 있을 가능성이 있다. cross_spec 체커가 이미 동일 파일의 `appUrl` 제거에 대해 CRITICAL 충돌을 보고한 상황에서, `install_token` 라이프사이클 변경까지 전파되지 않으면 DB 상태와 코드 동작 간 불일치 위험이 추가로 쌓인다. 즉각적 조치보다는 spec 동기화 점검을 구현 착수 전에 완료하는 것이 권장된다.

---

## 위험도

LOW
