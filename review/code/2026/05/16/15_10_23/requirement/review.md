# 요구사항(Requirement) 리뷰

리뷰 대상: consistency-check 산출물 6건 + spec 변경 2건 (spec/1-data-model.md, spec/2-navigation/4-integration.md, spec/4-nodes/4-integration/4-cafe24.md)

---

## 발견사항

### 1. 배너 클릭 동작 — 기능 완전성 결여 및 비즈니스 로직 미정의

- **[CRITICAL]** 배너 클릭 시 상태 필터 전환 동작이 단일 선택 칩 모델과 구조적으로 불일치
  - 위치: `spec/2-navigation/4-integration.md` §2.4 "Need attention" 배너 diff (line 1348)
  - 상세: 변경된 spec은 "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환"이라 기술하지만, §2.3 상태 칩은 단일 선택 모델(`All / Connected / Expiring / Expired / Error`)이다. 세 상태를 동시에 활성화하는 UI 표현이 없으므로 이 동작은 실제로 구현 불가능하다. 삭제된 Rationale "Attention 가상 필터값" 항이 정확히 이 문제를 기술하고 있었으며, 해결책(`Attention` 단일 칩 + `?status=attention`)도 함께 제거됐다. cross_spec 리뷰(발견사항 1)가 동일 충돌을 CRITICAL로 지적했으나, 해당 리뷰 문서 자체는 미완 구현이 아닌 spec 변경을 다루고 있어 요구사항 관점에서 별도 지적이 필요하다.
  - 제안: (A) `Attention` 칩·`?status=attention` 가상 필터값을 spec에 복원하거나 (B) §2.3 칩을 다중 선택 모델로 전환하는 결정을 명시적으로 spec에 기술해야 한다. 현재 상태는 기능을 삭제했으나 대체 구현을 정의하지 않은 미완성 요구사항이다.

---

### 2. 배너 조건 — 엣지 케이스 방어 로직 삭제로 이중 카운트 가능

- **[WARNING]** `token_expires_at <= now() + 7d` 단순화로 `expired` 행이 "만료 임박"에도 집계되는 이중 카운트 발생
  - 위치: `spec/2-navigation/4-integration.md` §2.4 diff (line 1347), §11.4 diff (line 1378)
  - 상세: 기존 spec은 배너 조건에 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'`를 사용해 이미 `expired`가 된 행이 "만료 임박" 카운트에 중복 포함되는 것을 방어했다. `expired` 상태의 행은 `token_expires_at <= now()`를 이미 만족하므로 단순화된 조건 `token_expires_at <= now() + 7d` 에도 포함된다. 결과적으로 `expired` 행은 `status IN (expired, error)` 조건에서 1번, `token_expires_at <= now() + 7d` 조건에서 1번 더 집계돼 배너 카운트가 실제보다 부풀어오른다. §11.4 UI 배지도 동일하게 단순화됐으므로 사이드바 배지 숫자도 동일한 오류를 갖는다. naming_collision 리뷰(발견사항 1·3) 및 cross_spec 리뷰(발견사항 3)가 연관 문제를 지적했다.
  - 제안: 배너 조건과 §11.4 UI 배지 조건 모두에 `status NOT IN (expired, error, pending_install)` 가드를 추가하거나, OR 구조(`status IN (expired, error)` 별도 + `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'`)로 명시적으로 분리한다.

---

### 3. `GET /api/integrations` status 파라미터 — 비즈니스 로직 명세 삭제

- **[WARNING]** `expiring` 가상 필터값의 WHERE 절 변환 규칙이 spec에서 완전히 제거됨
  - 위치: `spec/2-navigation/4-integration.md` §9.1 diff (line 1366)
  - 상세: 변경된 §9.1은 `GET /api/integrations` status 파라미터의 허용값과 변환 규칙을 모두 삭제하고 "목록 조회" 한 줄만 남겼다. §2.3 상태 칩에 `Expiring (7일 이내)` 칩이 여전히 존재하므로 프론트엔드는 `?status=expiring`을 백엔드로 전송한다. 그러나 백엔드가 이 가상 필터값을 `status='connected' AND token_expires_at within 7d` WHERE 절로 변환한다는 규칙이 삭제됐으므로, 구현자는 `expiring`을 DB Enum 직접 값으로 처리할 가능성이 있다. `expiring`은 DB Enum(`connected`/`expired`/`error`/`pending_install`)에 없으므로 0건 반환이 발생한다. cross_spec 리뷰 발견사항 4가 동일 문제를 WARNING으로 지적했다.
  - 제안: §9.1에 `expiring` 가상 필터값 정의와 변환 규칙(`status='connected' AND token_expires_at IS NOT NULL AND token_expires_at <= NOW() + INTERVAL '7d'`)을 복원하거나, §2.3 칩 목록에서 `Expiring`이 가상값임을 명확히 표기하고 변환 규칙을 spec의 다른 위치에 반드시 기술해야 한다.

---

### 4. `GET /api/integrations/:id` appUrl 필드 — 반환값 정의 미완성

- **[WARNING]** IntegrationDto의 `appUrl` 필드가 삭제됐으나 프론트엔드 테스트·노드 spec의 에러 복구 안내 경로가 남아 있음
  - 위치: `spec/2-navigation/4-integration.md` §9.1 diff (line 1369), §4.2 App URL 카드 제거 (line 1357)
  - 상세: 이전 spec은 `IntegrationDto`에 `appUrl: string | null` 필드를 포함하며 Cafe24 Private 통합에서 App URL 경로를 노출했다. 이번 변경은 이 필드와 Overview 탭 "App URL 카드"를 모두 삭제했으나, `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx`의 mock 데이터(line 133, 173, 197)는 `appUrl` 필드를 여전히 참조한다. `spec/4-nodes/4-integration/4-cafe24.md`의 에러 복구 안내("통합 상세 페이지에서 현재 App URL 확인")도 삭제된 UI 요소를 가리킨다. 결과적으로 Cafe24 Private 앱 운영자가 HMAC 검증 실패 에러 페이지의 안내를 따라 상세 페이지에서 App URL을 찾을 수 없게 된다. 이는 사용자 운영 흐름의 단절이다. cross_spec 리뷰 발견사항 2와 6이 동일 문제를 지적했다.
  - 제안: (A) `appUrl` 필드와 App URL 카드를 spec에 복원한다. (B) 실제 제거하려면 `scope-tab.test.tsx` mock 데이터 갱신, `4-cafe24.md` §9 에러 복구 안내 문구 대체 접근 경로 명시, `spec/data-flow/5-integration.md` 동기화가 동시에 이루어져야 한다.

---

### 5. `install_token` 라이프사이클 — 의도와 구현 간 괴리

- **[WARNING]** callback 성공 시 `install_token`·`install_token_issued_at` NULL 처리 여부가 두 spec 문서 간 상충
  - 위치: `spec/1-data-model.md` §2.10 Integration diff (lines 609–610) vs `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" diff (line 1409)
  - 상세: `spec/1-data-model.md`의 갱신된 `install_token` 설명은 "callback 성공 또는 TTL 만료 시 NULL"이라 기술하고, `install_token_issued_at`도 "callback 성공 시 NULL"이라 기술한다. 그러나 `spec/2-navigation/4-integration.md` Rationale의 갱신된 "TTL 기준" 항은 "callback 성공 시 `install_token`과 함께 `install_token_issued_at`도 NULL로 비워진다"고 기술한다. 이 두 표현은 일치하는 것으로 보이지만, 동일 커밋의 `spec/2-navigation/4-integration.md`에서 삭제된 이전 Rationale 텍스트("callback 성공 시 보존 — post-install navigation의 식별 키이며...")와 모순된다. 즉 이전 버전에서는 callback 성공 시 install_token이 보존됐으나, 이번 변경에서 callback 성공 시 NULL로 처리하는 방향으로 전환됐다. 이 전환의 근거가 Rationale에 명시되지 않았다.
  - 제안: Rationale에 "callback 성공 시 install_token을 NULL로 전환한 이유"를 명시한다. 이전에는 post-install navigation의 식별 키로 보존했으나 해당 기능(App URL 카드)이 제거됐으므로 NULL 처리가 가능해진 것이라면 그 연계를 명시해야 한다. 백엔드 구현자가 어느 쪽이 최신 정책인지 판단할 기준이 현재 없다.

---

### 6. `spec/4-nodes/4-integration/4-cafe24.md` §2 / §9.9 — 의도와 구현 간 괴리

- **[WARNING]** §2 설정 UI의 "편집 버퍼" 설명이 Phase 3(메타데이터 기반 동적 폼) 방향과 불일치
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 diff (line 1451), §9.9 diff (lines 1461–1475)
  - 상세: 변경된 §2는 "Fields: ... 편집 버퍼: UI는 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state로 관리"라고 기술한다. 그러나 §9.9 Rationale의 채택안 (B)는 동일하게 "내부 편집 버퍼 — `Array<{key, value}>` 형태로 React state에 유지"라 기술한다. 이 두 내용은 일치하지만 CHANGELOG의 `2026-05-16 (ux-cleanup)` 항("Phase 3(PR #88, Cafe24Config 재작성)가 옛 KeyValueEditor + 편집 버퍼 패턴을 완전히 폐기" — 삭제됨)이 가리키는 방향과 상충한다. ux-cleanup CHANGELOG 항이 이번 변경으로 삭제됐으므로 현재 spec 텍스트에서는 "편집 버퍼가 여전히 사용된다"는 의미로 읽히는데, 실제 구현(Phase 3)에서 폐기됐다면 spec이 잘못된 구현을 기술하게 된다. rationale_continuity 리뷰가 간접적으로 연관됐다.
  - 제안: §2의 "편집 버퍼" 설명과 §9.9의 채택안이 현재 실제 구현 상태(Phase 3 이후)를 정확히 반영하는지 확인한다. Phase 3에서 편집 버퍼 패턴을 폐기했다면 §2와 §9.9 모두에서 관련 내용을 제거해야 한다. 폐기하지 않았다면 삭제된 ux-cleanup CHANGELOG 항의 설명이 오류이므로 Rationale에 정정 근거를 추가한다.

---

### 7. `spec/2-navigation/4-integration.md` §11 — 폐기된 상태 전이 표현 잔존

- **[WARNING]** §11 본문의 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 경로를 연상시킴
  - 위치: `spec/2-navigation/4-integration.md` §11 서두 2번째 문단 (rationale_continuity 리뷰 지적, line 801)
  - 상세: Rationale에서 "refresh 실패 시 `error(auth_failed)` 채택, 옛 `expired(refresh_failed)` 분기 폐기"를 명시했다. 그러나 §11 본문에 "갱신 실패한 토큰 셋은 그대로 expire 처리되어 사용자에게 reauthorize 권장"이라는 표현이 남아 있다. 이는 refresh 실패 시 `expired` 상태로 전이하는 옛 경로를 연상시켜 구현자가 `error(auth_failed)` 대신 `expired`로 잘못 구현할 여지가 있다.
  - 제안: §11 해당 문구를 "갱신 실패한 토큰 셋은 `error(auth_failed)`로 전이되어 사용자에게 reauthorize 권장"으로 정정한다.

---

### 8. consistency-check 산출물 — `plan_coherence` 리뷰의 `[ ]` 체크박스 미처리 항목

- **[INFO]** `plan_coherence` 리뷰 발견사항 중 `cafe24-mall-dup-ux.md` `[ ] consistency-check --impl-prep` 체크박스 미갱신이 규약 위반으로 지적됨
  - 위치: `review/consistency/2026/05/16/14_28_20/plan_coherence/review.md` 발견사항 4번째 항목
  - 상세: consistency-check 세션이 완료된 시점에 `cafe24-mall-dup-ux.md`의 해당 체크박스를 `[x]`로 갱신해야 한다. 현재 review 산출물은 이를 요구하고 있으나 plan 갱신이 이루어졌는지 리뷰 파일 자체로는 확인 불가하다. plan 문서가 미갱신 상태라면 CLAUDE.md의 "작업 이후: 결과를 해당 위치의 살아있는 문서에 반영" 원칙 위반이다.
  - 제안: `plan/in-progress/cafe24-mall-dup-ux.md`의 `[ ] consistency-check --impl-prep` 항목을 `[x]`로 갱신한다.

---

### 9. `spec/data-flow/5-integration.md` — appUrl 동기화 점검 미수행 가능성

- **[INFO]** cross_spec 리뷰 발견사항 5에서 `spec/data-flow/5-integration.md`의 appUrl 참조 동기화 점검이 권장됐으나 이번 변경에 포함되지 않음
  - 위치: `spec/data-flow/5-integration.md` line 78–79 (변경 대상 파일 미포함)
  - 상세: `GET /api/integrations/:id` 응답의 `appUrl` 필드가 삭제됐으나 data-flow spec의 시퀀스 다이어그램에 해당 흐름이 존재할 수 있다. 이번 리뷰 대상 파일에 포함되지 않아 동기화 여부 미확인 상태다. `POST /api/integrations/oauth/begin` → `appUrl` 흐름은 변경 없으므로 영향 없으나, `GET /api/integrations/:id` → `appUrl` 흐름이 별도로 기술된 부분이 있다면 갱신이 필요하다.
  - 제안: `spec/data-flow/5-integration.md`를 확인해 삭제된 `GET /api/integrations/:id` → `appUrl` 흐름이 기술된 곳이 있으면 해당 부분도 갱신한다.

---

### 10. `spec/4-nodes/4-integration/4-cafe24.md` §9.9 — 호환 키 보존 결정 삭제

- **[INFO]** Phase 3 결정사항인 "호환 키 보존(Operation 변경 시 교집합 키 유지)" 설명이 §9.9에서 삭제됨
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 diff (line 1472 삭제 항목)
  - 상세: 삭제된 §9.9 텍스트에는 "Operation 변경 시 새 op의 `fields[].name`과 현재 `config.fields`의 키 집합의 교집합만 유지해 무관 키는 drop. Resource 변경 시는 전체 reset"이라는 구현 결정이 포함되어 있었다. 이 결정은 CHANGELOG `2026-05-16 (후속)` 항에만 간략 언급되고 §9.9에서는 삭제됐으므로, 구현자가 Operation 변경 시 fields를 전부 reset할지 교집합만 유지할지 spec에서 명확히 찾기 어렵게 됐다. §2 설정 UI 설명과 §1 config 스키마에도 이 동작이 기술되어 있지 않다.
  - 제안: §2 설정 UI의 Operation 드롭다운 설명에 "Operation 변경 시 호환 키(교집합)만 유지, Resource 변경 시 전체 reset" 동작을 한 줄로 추가하거나, §9.9에 해당 결정을 복원한다.

---

## 요약

이번 변경의 핵심은 `spec/2-navigation/4-integration.md`에서 `Attention` 가상 필터 칩, `?status=attention` 쿼리값, `GET /api/integrations/:id`의 `appUrl` 필드, App URL 카드, 그리고 상세한 배너 조건·API 파라미터 변환 규칙을 축소·제거하는 방향의 개정이다. 요구사항 관점에서 가장 심각한 문제는 배너 클릭 동작이 "상태 필터를 `Expiring|Expired|Error`로 자동 전환"으로 기술되어 있으나 단일 선택 칩 모델로는 세 상태를 동시에 활성화할 UI 표현이 존재하지 않는다는 것이다(CRITICAL 1건). 이는 기능을 명시했으나 구현 불가능한 상태로 남긴 미완성 요구사항에 해당한다. 추가로 배너·배지 이중 카운트 엣지 케이스(WARNING), `expiring` 가상 필터 변환 규칙 미정의로 인한 0건 반환 위험(WARNING), `appUrl` 삭제 이후 사용자 운영 흐름 단절 및 테스트 코드 불일치(WARNING), `install_token` 라이프사이클 명세의 두 spec 문서 간 미묘한 표현 불일치(WARNING) 등 4건의 WARNING이 발견됐다. 이 변경들은 일관성 검토 결과에서 이미 다수의 CRITICAL·WARNING이 식별된 상태이며, 구현 착수 전 spec 방향 결정(Attention 칩 복원 또는 UI 모델 전환, appUrl 복원 또는 코드 동시 갱신)이 선행되어야 한다.

---

## 위험도

HIGH
