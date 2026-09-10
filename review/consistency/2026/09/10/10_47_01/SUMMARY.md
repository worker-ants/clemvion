# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 성공, 전문 확보 완료(재시도 필요 항목 없음).

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-integration-dto-pointer.md`, `4-integration.md §9.1` 경계 문장 삽입)은 사실관계·명명·plan 정합성 전 축에서 실측과 일치하며, 발견된 3건의 WARNING은 모두 문구 좁히기·SoT 위치 이동·삽입 시 표 구문 보존이라는 좁은 편집으로 해소 가능하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 발견이 없어 인계할 항목 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 삽입 문구 "전이 규칙 SoT = §2.10" 이 과잉 일반화 — `tokenExpiresAt`(만료 스캐너 판정)·`lastRotatedAt`(background-refresh 임계) 의 실제 전이/사용 규칙은 `4-integration.md` 자신의 §6·§11 이 소유하고, §2.10 의 `consecutiveNetworkFailures` 항목조차 §6 을 전이 규칙 SoT 로 재지목한다 | `spec/2-navigation/4-integration.md` §9.1 삽입 텍스트("의미·전이 규칙·마이그레이션은 §2.10 이 SoT") | 같은 문서 §6 상태 전이(720행), §11.1 스캐너 잡 | "전이 규칙"을 §2.10 에 블랭킷 귀속시키지 말고 범위 좁히기: "의미·마이그레이션은 §2.10 SoT, 전이 규칙에 관여하는 컬럼(tokenExpiresAt·lastRotatedAt·consecutiveNetworkFailures)의 전이 규칙 자체는 본 문서 §6·§11 이 SoT" 로 수정 |
| 2 | rationale_continuity | 새 경계 문장의 "왜"(derived 경계를 앞세우는 이유·§2.10 비복제 이유·§9.4 아닌 이유·캐비엇 유지 비용) 가 spec 의 `## Rationale` 이 아니라 plan draft 에만 남아, `plan/complete/` 이동 후 다음 검토자가 spec 안에서 근거를 찾지 못함 | `plan/in-progress/spec-draft-integration-dto-pointer.md` 35~121행("왜 " 3문단), 체크리스트 128행 | `spec/2-navigation/4-integration.md ## Rationale`(기존 관례: "Cafe24 App URL 상세 페이지 표시", "§9.1 표 비고에 명시한 이유" 항목들) | `4-integration.md ## Rationale`에 "IntegrationDto §9.1 derived-필드 주장 경계 명시" 소제목으로 draft 의 3문단 요약 + 캐비엇 유지 비용을 옮겨 적을 것(체크리스트 130행 자매 트래커 보강 항목과 함께 추가) |
| 3 | convention_compliance | 제안 삽입 텍스트가 코드펜스 안에서 11줄로 word-wrap 되어 있고, 대상 표 행(795행)은 물리적으로 2,052자 단일 라인(GFM 표는 리터럴 개행 불허) — 그대로 복붙 적용 시 표 파싱이 깨질 위험 | `plan/in-progress/spec-draft-integration-dto-pointer.md` "변경안" 코드펜스 | `spec/2-navigation/4-integration.md` §9.1 795행(단일 라인 표 행) | 체크리스트에 "삽입 시 word-wrap 제거, 기존 행과 동일한 물리적 한 줄로 이어붙일 것" 한 줄 추가. 적용 커밋에서 `git diff` 로 대상 행이 여전히 단일 라인인지 확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 같은 §9.1 행의 인접 서술(`appUrl`/`autoRefresh`)은 후속 작업을 `[cafe24 백로그 C-6](...)` 형태로 직접 하이퍼링크하는데, target 의 새 캐비엇 문장("노출 중단이 별도 항목으로 추적 중")은 어느 트래커인지 링크 없이 산문으로만 서술 | `spec/2-navigation/4-integration.md` §9.1 신규 캐비엇 문장 | 편집 시 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 직접 하이퍼링크를 붙여 같은 문서의 기존 관행과 맞출 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 5필드 존재·§2.10 위치·DTO 소스·앵커 전부 target 주장과 일치. 유일한 흠은 "전이 규칙" 을 §2.10 에 블랭킷 귀속시킨 문구(WARNING) |
| rationale_continuity | LOW | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. "왜" 서술이 spec Rationale 대신 plan draft 에만 남는 배치 문제(WARNING) |
| convention_compliance | LOW | 규약 문서 조항 위반 없음(SoT 이중화 회피 원칙 오히려 부합). 삽입 텍스트 word-wrap 으로 인한 GFM 표 손상 운영 리스크(WARNING) |
| plan_coherence | LOW | origin 트래커 차단 전제 실측 검증 완료, 열린 결정(consecutiveNetworkFailures 제거 여부) 가로채지 않음, 숨은 인벤토리 사본 없음. 인접 관행과의 하이퍼링크 스타일 불일치(INFO) |
| naming_collision | NONE | 신규 식별자(요구사항 ID·엔티티/타입·endpoint·이벤트·환경변수·파일 경로) 전혀 도입 안 함 — 발견사항 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 항목 없음 — BLOCK:NO) WARNING #3부터 우선 반영: 체크리스트에 "삽입 시 물리적 한 줄로 이어붙일 것" 명시(적용 실패 시 표 자체가 깨지는 가장 직접적인 리스크).
2. WARNING #1 반영: "전이 규칙" 범위를 tokenExpiresAt·lastRotatedAt·consecutiveNetworkFailures 로 좁히고 §6·§11 을 해당 규칙의 SoT 로 명시.
3. WARNING #2 반영: `4-integration.md ## Rationale` 에 짧은 항목 추가하여 draft 의 "왜" 서술을 spec SoT 위치로 이관.
4. INFO #1 반영: 캐비엇 문장에 `spec-draft-nullable-notation-followups.md` 직접 하이퍼링크 추가.
