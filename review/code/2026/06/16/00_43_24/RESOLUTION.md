# RESOLUTION — config C-2 (generatedKey 자동클리어 + auth-config ipWhitelist 저장검증)

대상 PR 범위: `git merge-base origin/main HEAD`(`1899c05e`)..HEAD
리뷰 세션: 1차 `review/code/2026/06/16/00_27_07` (MEDIUM, 0C/6W), 2차(fresh) `00_43_24` (LOW, 0C/5W)

## 종결 상태
- **Critical 0건** (양 세션).
- 1차 Warning 6건 중 코드 수정 대상은 Commit `8ab9f197` 에 일괄 반영(아래 §1).
- 2차(fresh) Warning 5건은 전부 의도된 설계·범위 밖·또는 loop-avoidance 에 따라 코드 무변경 수용(§2).
- 2차 위험도 LOW + 0 Critical → 종결 조건 충족. 추가 코드 수정 시 fresh review 가드 재무장 → 무한 리뷰 루프([[feedback_review_gate_loop_avoidance]]) 이므로 마지막 세션 findings 는 코드 무변경 disposition.

---

## §1. 1차 리뷰(00_27_07) 반영 — Commit 8ab9f197

| 발견 | 처분 | 내용 |
|------|------|------|
| W1/W4 revealedSecret bare setTimeout 누수·테스트 부재 | **수정** | `revealedSecret` 도 `generatedKey` 와 동일 `useEffect([value]) + clearTimeout` 패턴으로 통일, `revealMutation.onSuccess` 의 raw setTimeout 제거. 공유 상수 `SECRET_AUTOCLEAR_MS` 도입. reveal 자동클리어·언마운트 cleanup 테스트 2건 추가 |
| W5 backend CIDR 경계 테스트 누락 | **수정** | `0.0.0.0/0`·`2001:db8::/128` 유효, `2001:db8::/129` 무효 케이스 추가 (front-back 수용집합 정렬 확인) |
| INFO#9 Update DTO Swagger example 누락 | **수정** | `@ApiPropertyOptional example: ['10.0.0.0/8','203.0.113.42']` 추가 |
| INFO#10/#13 JSDoc·constraint 클래스 주석 | **수정** | `IsIpOrCidrConstraint` 클래스 JSDoc 추가 |
| INFO#12/#13 defaultMessage·비배열 테스트 | **수정** | `defaultMessage` 반환·단일문자열→`@IsArray` 위반 테스트 추가 |
| INFO#7 테스트 매직넘버 | **수정** | `AUTOCLEAR_MS` 상수 도입 |
| W2 frontend IP 검증 중복 (`auth-config-form.ts` regex vs backend ip-address) | **수용(의도된 설계)** | `auth-config-form.ts` 주석이 명시: "최종 시행은 백엔드 ip-address 기반 fail-closed 매칭 — 본 검증은 입력단계 UX 가드". frontend=UX 가드 / backend=SoT 이원화는 의도된 설계. 공유 패키지화는 별도 기술부채로 등록 권고 |
| W3 AuthenticationPage God-component(SRP) | **범위 밖** | 1차 리뷰도 "이번 PR 범위 밖 — 기술 부채 등록 권고" 로 명시. C-1(God Component 분리) 별도 슬라이스 소관 |
| W6 @IsIpOrCidr 추가로 기존 무효 IP 전송 클라이언트 400 (breaking) | **수용(의도)** | 저장 무결성 강화가 본 작업의 목적. 무효 IP/CIDR 는 spec §2.17 상 애초에 유효값이 아님. 기존 DB row 는 검증 미적용(신규 write 만 검증) → 데이터 보존 영향 없음. 외부 직접호출 클라이언트 공지는 운영 단계 사항 |
| INFO#1 [SPEC-DRIFT] generatedKey 자동클리어 spec 미기재 | **반증(이미 반영)** | 본 PR 이 `spec/2-navigation/6-config.md §A.4` 에 "평문 자동 hide 정책은 create/regenerate 1회 노출에도 동일 적용… 30초 후 자동 비움" 1행을 이미 추가함. 리뷰어가 base 기준으로 판단한 false-positive |

## §2. 2차 fresh 리뷰(00_43_24) disposition — 코드 무변경

| 발견 | 처분 | 근거 |
|------|------|------|
| W1 `0.0.0.0/0` allow-all CIDR 수용 | **수용(의도)** | `0.0.0.0/0`/`::/0` 는 유효 CIDR 이며 런타임 `parseIp`·frontend 검증 모두 수용. `@IsIpOrCidr` 는 **형식** 검증이 책임이고, allow-all 의 **의미적** 경고는 제품/UX 정책 결정 — 저장검증에서 거부하면 런타임 수용기준과 drift 발생. UX 경고 안내는 planner 영역 후속 검토 |
| W2 `config` 필드 임의 JSON(@IsObject) | **범위 밖(pre-existing)** | 본 작업은 `ipWhitelist` 검증이 범위. `config` 의 type 별 스키마 검증은 기존 설계(JSONB)이며 별도 작업 |
| W3 비밀값 React state 평문 보관 | **수용(기능 본질)** | 1회 평문 표시는 기능 요구. 리뷰어도 "30초 자동클리어로 노출창 제한 → 허용 범위 내 위험" 으로 평가 |
| W4 테스트 `AUTOCLEAR_MS` 하드코딩(향후 drift) | **수용(loop-avoidance)** | 현재 값 30_000 일치, 테스트 주석에 "page.tsx 와 동일해야 함" 명시. `SECRET_AUTOCLEAR_MS` export+import 개선은 정당하나, 본 fresh 세션 후 코드수정은 리뷰 가드 재무장 → 무한루프. 마이너 테스트 품질이라 코드 무변경 수용, 후속 grooming 권고 |
| W5 `clearTimeout` spy timer-ID 미좁힘 | **수용(loop-avoidance)** | 테스트 정밀도 개선점이나 W4 와 동일 사유로 코드 무변경. 현 테스트는 cleanup 호출 + 만료 후 no-throw 로 누수 부재를 충분히 검증 |
| INFO#5 / side_effect: developer 워크트리 spec 직접 수정 | **수용(rationale)** | CLAUDE.md 역할 규약상 spec 쓰기는 planner 전용이나, 본 건은 **이미 문서화된 규칙(§2.17 IP/CIDR 형식, §A.4 30초 자동 hide)의 fidelity 동기화 1행**이며 구현 코드와 번들(A-1 선례 commit 1beaab70). 사용자 작업지시가 "해당 config spec 에 검증 규칙 1행 동반" 을 명시 위임함. consistency `--impl-done` 으로 spec-code 정합 교차검증 |
| INFO#2 빈 배열 의미 spec 미명시 | **후속 권고** | `ip_whitelist=[]` = 화이트리스트 미설정(allow-all) 의미를 §2.17 에 명시하면 좋음 — planner 후속(본 PR 범위 밖) |
| INFO#4 validator JSDoc 의 WH-SC-09 출처 오해 | **수용(경미)** | 주석은 §2.17 과 WH-SC-09 를 함께 참조하며 "런타임 평가와 동일 기준" 맥락으로 기술. 오독 소지 낮음 |
| INFO#1,3,6,7,8,9,10,11,12,13 | **후속 권고** | regenerate 경로 테스트·useAutoclear 훅 추출·data-testid 등 — 기능 정확성 무관 grooming 항목. 별도 정리 권고 |

## §3. consistency --impl-done (review/consistency/2026/06/16/00_54_33)
- **BLOCK: NO** — Critical 0 / Warning 0 / INFO 7 (LOW). 변경된 두 spec + 코드 diff(merge-base..HEAD) 번들로 5 checker 사후 검증.
- INFO 처분:
  - INFO#4/#5 (Rationale 미기재) → **반영**: `1-data-model.md §2.17.3` 에 ip_whitelist 저장검증 근거, `6-config.md` R-2 에 평문 30초 자동 hide 단일화 근거 1행씩 추가.
  - INFO#6 (plan 추적) → **반영**: `auth-config-webhook-followups.md §3` CIDR/IPv6 항목 해소 표기.
  - INFO#7 (`SECRET_AUTOCLEAR_MS` export) → **후속 권고**: codebase 변경이라 지금 적용하면 리뷰/--impl-done 가드 재무장 → loop. 현재 값 일치·주석 명시로 충분, grooming 이월.
  - INFO#1/#2/#3 (webhook/data-flow cross-ref·§2.17.2 SoT 경계) → **수용(필수 아님)**: §2.17 가 저장검증 SoT, WH-SC-09 가 런타임 enforcement 로 영역 분리. §2.17 Rationale 에 SoT 관계를 명시해 경계 보강.

## 검증 게이트 (Commit 8ab9f197 기준)
- backend `auth-configs` 전체: 91 tests PASS (DTO 검증 33 포함).
- frontend `authentication` 전체: 40 tests PASS (create/reveal 자동클리어·언마운트 4 포함).
- lint(backend·frontend 변경분) clean, backend `nest build`·frontend production build PASS.
- e2e: dockerized backend 스위트 202/202 PASS (docker logs 확인). 종료 시 jest open-handle hang 은 pre-existing 인프라 quirk(테스트 결과 무관).
