# Cross-Spec 일관성 검토 — `spec-draft-avatar-storage-key.md`

## 발견사항

- **[CRITICAL]** `spec/5-system/2-api-convention.md` §9 "파일 업로드" 가 target 의 scope 밖에 있는데, target 이 만드는 새 사실과 정면 모순한다
  - target 위치: target 은 `spec_impact` 를 `0-overview.md` / `data-flow/4-file-storage.md` / `2-navigation/9-user-profile.md` / `5-system/3-error-handling.md` 4개로 한정한다(frontmatter). §D-2 는 `9-user-profile.md` 의 `POST /api/users/me/avatar` 취소선을 해제하고 "아바타 **이미지 파일** 업로드. `multipart/form-data` 의 `file` 필드" 로 명시한다.
  - 충돌 대상: `spec/5-system/2-api-convention.md:284` — "현재 파일 업로드 엔드포인트는 Knowledge Base 문서 업로드(`POST /api/knowledge-bases/:id/documents`)가 유일하다. **유저 아바타는 multipart 업로드가 아니라 `avatarUrl` URL 필드로 관리한다(별도 업로드 엔드포인트 없음)**."
  - 상세: target 이 4개 문서에 적용되면 `9-user-profile.md §6.1` 은 "`POST /api/users/me/avatar` 는 실재하는 multipart 업로드 엔드포인트다" 라고 말하고, 같은 저장소의 `2-api-convention.md §9` 는 그 반대("별도 업로드 엔드포인트 없음")를 그대로 유지한다. 이는 이번 BLOCK 을 만든 것과 **동종의 결함**이다 — `0-overview.md` Rationale 이 "예외는 KB 뿐" 이라고 배타적으로 서술해 실제 코드(Avatar 도 예외)와 충돌했던 것과 같은 패턴이, 이번엔 `2-api-convention.md` 가 "avatar 업로드 엔드포인트는 없다" 고 배타적으로 서술해 target 이 되살리는 실제 엔드포인트와 충돌한다. `rationale_continuity`/`cross_spec` 관점에서 이미 한 번 지적된 실패 모드(누락된 4번째 파일)가 그대로 재발한 것이다. 이 파일은 이번 검토의 번들에 `#### spec/5-system/2-api-convention.md` 로 포함돼 있었으나 컨텍스트 예산 초과로 본문이 절단되어 있었다(`review/.../11_07_21/_prompts/cross_spec.md:1709`) — 즉 orchestrator 는 관련 파일로 인지했지만 target 작성자는 실제 본문을 못 보고 놓쳤을 가능성이 높다.
  - 부수 갭(같은 절, 같은 등급은 아니지만 함께 정정 필요): §9 표의 "최대 크기 | 단일 파일 50MB" 행은 "허용 타입" 행과 달리 "엔드포인트별 제한" 이라는 단서가 없어 유일한 절대값처럼 읽힌다. target 의 아바타 엔드포인트는 2MB 로 이보다 훨씬 작다 — 모순은 아니지만(2MB < 50MB), 이 표가 갱신되지 않으면 "50MB 가 시스템 전체 상한" 이라는 오독이 남는다.
  - 제안: target 의 `## 변경안` 에 `### G. spec/5-system/2-api-convention.md §9` 를 추가해 (a) line 284 의 "유저 아바타는 … 별도 업로드 엔드포인트 없음" 문장을 삭제하고 "Knowledge Base 문서 업로드"·"아바타 업로드"(`POST /api/users/me/avatar`, 2MB, `png/jpg/jpeg/webp/gif`) 두 사용처로 갱신, (b) "최대 크기" 행에 "(엔드포인트별 상이 — KB 50MB, Avatar 2MB)" 같은 단서 추가. `spec_impact` frontmatter 와 `pending_plans` 동반 등재 대상에도 이 파일을 포함시킬 것.

- **[INFO]** F 절(`error-handling.md`)의 삽입 위치가 명시되지 않음
  - target 위치: `## 변경안 F. spec/5-system/3-error-handling.md §1 에러 카탈로그` — 다른 절(A~E)은 모두 `:줄번호` 앵커를 명시하는데 F 만 "§1" 로만 지목한다.
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.3(코드/설명/HTTP 3열, generic validation)과 §1.8~§1.9(코드/status/설명/도메인 SoT 4열, 도메인 전용 — 예: KB, 워크스페이스 멤버 직접 추가) 두 가지 기존 패턴.
  - 상세: F 가 제시한 표는 3열(코드/설명/HTTP) 이라 §1.3 스타일과 맞다. 그런데 `INVALID_FILE_TYPE` 은 "KB 문서 업로드와 아바타 업로드가 공용" 이라고 스스로 적어 §1.8(KB 전용)과도 겹치는 영역이다. §1.8/§1.9 가 최근 신설된 "도메인 SoT 링크" 패턴이므로, 다음 사람이 "이 코드는 왜 §1.3 에 있고 §1.8 처럼 도메인 SoT 컬럼이 없나" 를 다시 묻게 될 수 있다.
  - 제안: §1.3 삽입으로 확정한다면 그 이유("범용 검증 에러이지 KB 전용이 아니다")를 한 줄 남기거나, 정확한 삽입 지점(`:NN` 라인 앵커)을 다른 절과 동일하게 명시.

- **[INFO]** `plan/in-progress/spec-update-avatar-upload-implemented.md` 와의 스코프 불일치
  - target 위치: target `## 관련` — "위임 트래커: `spec-update-avatar-upload-implemented.md`"
  - 충돌 대상: 해당 트래커 본문 — "**대상은 세 문서다**"(`9-user-profile.md`/`0-overview.md`/`data-flow/4-file-storage.md`) 라고 명시, `error-handling.md`·`api-convention.md` 는 언급 없음.
  - 상세: target 은 트래커보다 넓은 4개 문서를 다루면서도(§F 로 error-handling.md 추가) 트래커 자체의 체크리스트는 갱신 대상에서 빠져 있다(target 이 트래커 파일을 고치는 절이 없음). 트래커가 이제 stale 범위 서술을 갖게 된다. 위 CRITICAL 이 해소되면(§G 추가) 트래커는 4~5개 문서를 추적해야 하므로 더 벌어진다.
  - 제안: target 실행 시 트래커의 "대상은 세 문서다" 문장과 체크리스트를 target 이 실제로 다루는 범위(§G 포함 시 5개 문서)로 동기화.

## 요약

target 의 핵심 정정(§A/§B — `spec/0-overview.md` Rationale 을 "KB 만 예외" 에서 "KB·Avatar 두 예외" 로 바꾸는 것)은 BLOCK 을 낸 근본 충돌을 정확히 겨냥하고 있고, `data-flow/4-file-storage.md`·`2-navigation/9-user-profile.md`·`5-system/3-error-handling.md` 세 문서에 대한 갱신안도 실제 라이브 spec 본문과 대조했을 때 서로 정합적이며 요구사항 ID·상태 전이·RBAC 축에서는 새로운 충돌을 만들지 않는다. 다만 **동일한 실패 패턴(배타적 서술이 새 사실과 충돌)이 target 의 스코프 밖에 있는 `spec/5-system/2-api-convention.md §9`에 그대로 남아 있다** — 이 파일은 "유저 아바타는 별도 업로드 엔드포인트가 없다" 고 명시하는데, target 이 다른 4개 문서에서 정확히 그 반대 사실을 확정하므로 target 을 그대로 적용하면 `spec/` 안에 새로운 자기모순이 생긴다. 이 파일은 조립 번들에 포함돼 있었으나 컨텍스트 예산으로 절단되어 있었다는 정황도 확인했다(작성자가 보지 못했을 개연성). 이 CRITICAL 1건만 target 의 `## 변경안` 에 절을 추가해 해소하면 cross-spec 관점에서는 채택 가능하다.

## 위험도

MEDIUM
