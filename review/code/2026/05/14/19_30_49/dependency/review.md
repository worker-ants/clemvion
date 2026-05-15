## 발견사항

---

**[INFO] 외부 라이브러리/패키지 의존성 변경 없음**
- 위치: 전체 변경 파일
- 상세: 이번 변경은 `spec/`, `review/` 하위의 마크다운 문서 전용이다. `package.json`, `requirements.txt` 등 실제 패키지 의존성 파일은 포함되지 않아 전통적 의미의 의존성 리뷰 대상이 없다.
- 제안: 해당 없음

---

**[WARNING] BullMQ 큐 스키마 변경 — 기존 소비자 런타임 의존성**
- 위치: `spec/data-flow/integration.md` (DRAFT 3C-bis), `review/consistency/2026-05-14_18-38-32/naming_collision/review.md`
- 상세: `integration-expiry` 큐 메시지 포맷을 `{ integrationId }` → `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 로 확장한다. 기존 소비자 코드가 `reason` 필드 없이 동작 중이면 롤링 배포 구간에서 `undefined` 분기 오류가 발생할 수 있다. spec에 "하위 호환: `reason ?? 'token_expiring'` 기본값 처리" 문구가 추가되었으나 이를 구현 plan(`cafe24-pending-polish.md` 변경 4)에 명시적 체크박스로 추적하지 않아 구현 단계에서 누락될 위험이 있다.
- 제안: `cafe24-pending-polish.md` 변경 4에 "BullMQ `integration-expiry` 소비자에 `reason ?? 'token_expiring'` 기본값 처리 추가 — 소비자 배포 후 생산자 배포 순서 준수" 체크박스를 명시한다.

---

**[WARNING] DB 마이그레이션 의존성 순서 미확정 — V0XX 플레이스홀더**
- 위치: `spec/1-data-model.md §3` (DRAFT 1D), `review/consistency/2026-05-14_18-23-55/convention_compliance/review.md`
- 상세: `install_token` 부분 인덱스 추가 마이그레이션이 "후속 V0XX로 추가한다"는 플레이스홀더로 기재되어 있다. V042가 이미 `install_token` 컬럼을 포함한 상태로 존재하므로, 인덱스 마이그레이션은 V043 이상이어야 하나 번호가 미결정이다. 구현 착수 시 `backend/migrations/` 의 실제 최대 버전을 확인하지 않으면 번호 gap이 발생할 수 있다.
- 제안: 구현 착수 직전 `backend/migrations/` 최대 V번호를 확인하여 인덱스 마이그레이션 번호를 확정하고 spec §3을 갱신한다.

---

**[WARNING] 외부 시스템 연동 경로 변경 — Cafe24 대시보드 재설정 의존성**
- 위치: `spec/4-nodes/4-integration/4-cafe24.md §9.4`, `spec/2-navigation/4-integration.md §9.2`
- 상세: App URL path가 `/oauth/install/cafe24` → `/oauth/install/cafe24/:installToken` 으로 변경된다. 기존에 Cafe24 Developers 대시보드에 App URL을 등록한 Private 앱 사용자는 `:installToken`이 포함된 새 경로로 외부 설정을 직접 업데이트해야 한다. 이 외부 작업 의존성이 배포 계획에 명시되어 있지 않다. 옛 경로는 410 Gone으로 완충 처리되나, 사용자가 Cafe24 측 설정을 변경하지 않으면 기존 연동이 즉시 동작 불능 상태가 된다.
- 제안: 릴리스 노트 또는 마이그레이션 가이드에 "기존 Cafe24 Private 앱 등록자는 App URL을 `…/cafe24/:installToken` 형식으로 재등록 필요"를 명시한다. `cafe24-pending-polish.md`에 해당 사용자 안내 항목을 추가한다.

---

**[INFO] `spec/conventions/swagger.md` 실존 여부 미확인 — 내부 문서 의존성**
- 위치: `spec/2-navigation/4-integration.md §9.4`, `review/consistency/2026-05-14_18-38-32/convention_compliance/review.md`
- 상세: 여러 spec 섹션이 `spec/conventions/swagger.md §2-4`를 규약 근거로 인용하나, 해당 파일의 실존 여부가 복수의 consistency check에서 "확인 불가"로 표기되었다. 파일이 없거나 §2-4 내용이 다르면 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 의 HTTP 상태 코드 근거가 dead reference가 된다.
- 제안: 구현 착수 전 `spec/conventions/swagger.md` 파일 실존 및 §2-4 조항 내용을 확인한다.

---

**[INFO] `review/consistency/2026-05-14_16-48-25/` 참조 — 존재하지 않을 수 있는 경로**
- 위치: `spec/2-navigation/4-integration.md ## Rationale` (DRAFT 2I)
- 상세: Rationale 섹션이 `review/consistency/2026-05-14_16-48-25/`를 cross-reference로 사용하나, worktree 내 consistency review 디렉토리는 `17-00-12`부터 시작한다. 링크가 빈 경로를 가리킬 경우 향후 추적성이 손상된다.
- 제안: spec 적용 전 해당 경로 실재 여부를 확인하고, 없으면 `2026-05-14_17-00-12`로 교체하거나 참조를 제거한다.

---

**[INFO] V041 마이그레이션 의존성 — `integration_oauth_state.provider_meta` 선행 확인 필요**
- 위치: `spec/data-flow/integration.md §2.1` (DRAFT 3D), `review/consistency/2026-05-14_18-38-32/cross_spec/review.md`
- 상세: DRAFT 3D가 `provider_meta (encrypted JSONB, V041)` 컬럼을 schema에 추가한다. V042가 이미 `install_token`을 추가한 상태이므로 V041이 V042 이전에 적용되어야 하나, `backend/migrations/` 에서 V041 파일 실존 여부가 확인되지 않았다. 적용 순서가 역전되면 `provider_meta` 컬럼이 없는 상태에서 변경 2/3 구현이 진행된다.
- 제안: `cafe24-pending-polish.md` 변경 2 첫 체크박스 앞에 "선행 확인: `integration_oauth_state.provider_meta` (V041) 실제 DB 적용 여부 — 미적용 시 V043으로 신설 후 진행"을 추가한다.

---

## 요약

이번 변경은 실제 패키지 파일을 포함하지 않는 spec/리뷰 문서 전용 변경이다. 의존성 관점의 핵심 위험은 세 가지다: (1) BullMQ 큐 스키마 확장으로 인한 소비자 하위 호환성 처리가 구현 plan에 미추적된 점, (2) `install_token` 인덱스 마이그레이션의 V번호가 플레이스홀더(`V0XX`)로 남아 있어 실제 적용 순서가 불확정인 점, (3) App URL path 변경이 Cafe24 Developers 대시보드의 외부 재설정을 요구하는데 이 사용자 액션이 배포 계획에 누락된 점. 세 항목 모두 구현 착수 전 plan 문서 보강으로 해소 가능한 수준이다.

## 위험도

**LOW** — 패키지 의존성 변경 없음. 내부 문서 cross-reference와 구현 단계 마이그레이션 순서 관리가 주요 관심사이며, 모두 착수 전 점검으로 대응 가능하다. 외부 시스템(Cafe24) 재설정 의존성은 릴리스 전 사용자 가이드 작성이 필요하다.