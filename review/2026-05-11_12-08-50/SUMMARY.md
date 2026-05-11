# Code Review 통합 보고서

> 변경: `idea-workflow` → `clemvion` 일괄 리네임 (k8s 매니페스트·Dockerfile·README 전반)

## 전체 위험도
**HIGH** — 코드 로직 변경은 없으나, 기존 클러스터 in-place 적용 시 DB 연결 단절·Deployment 강제 재생성·TLS 인증서 오류 세 가지 즉각적 운영 장애가 발생할 수 있음. 신규 환경 배포 시에는 LOW.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Database | **DB 연결 단절** — `DB_DATABASE` 값이 `idea_workflow` → `workflow`로 변경됨. 기존 클러스터에 ConfigMap만 적용하면 backend·migrate-job 모두 즉시 연결 실패 | `k8s/base/configmap.yaml` | DB rename(`ALTER DATABASE idea_workflow RENAME TO workflow`) 선행 또는 overlay 패치로 기존 값 유지 후 2단계 전환 |
| 2 | Side Effect / K8s | **Deployment selector immutable 필드 충돌** — `spec.selector.matchLabels`의 `app.kubernetes.io/name` 변경은 불변 필드. 기존 Deployment가 존재하면 `kubectl apply` 실패, 강제 삭제·재생성 시 무중단 보장 불가 | `k8s/base/backend-deployment.yaml:14`, `frontend-deployment.yaml:14` | 배포 전 `kubectl delete deployment backend frontend -n idea-workflow` 선행 후 `kubectl apply -k` 실행; ArgoCD 사용 시 `Replace` sync option 활용 |
| 3 | Side Effect / Security | **TLS Secret 이름 불일치로 인증서 오류** — Ingress가 참조하는 `clemvion-*-tls` Secret은 클러스터에 존재하지 않음. 배포 즉시 TLS handshake 실패 | `k8s/base/ingress.yaml` | 기존 Secret 복사 또는 cert-manager `Certificate` CR `secretName` 선행 업데이트 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / K8s | **구 Ingress 리소스 orphan** — Kustomize는 이름 변경 시 구 Ingress를 삭제하지 않고 신규 생성; 두 Ingress 동시 활성화로 라우팅 충돌 가능 | `k8s/base/ingress.yaml` | 배포 후 `kubectl delete ingress idea-workflow-frontend idea-workflow-backend -n <ns>` 수동 정리 |
| 2 | Side Effect / K8s | **구 namespace `idea-workflow` orphan** — 기존 namespace와 내부 리소스(PVC 포함)가 자동 정리되지 않아 DB connection pool 이중 소비 및 과금 낭비 | 모든 overlay `kustomization.yaml` | 신규 배포 검증 후 `kubectl delete namespace idea-workflow` 수동 정리 |
| 3 | Dependency / CI | **CI 파이프라인 이미지 태그 동기화 미확인** — CI가 아직 `idea-workflow/*` 태그로 push하면 배포 후 `ImagePullBackOff` 발생 | 모든 `kustomization.yaml` `images:` 섹션 | CI 저장소에 동시 반영하거나 plan §리스크 3항에 이슈 링크 추가 |
| 4 | Dependency / cert-manager | **외부 cert-manager `Certificate` CR 미동기화** — `secretName`이 별도 저장소에 있으면 TLS 불일치 지속 | `k8s/base/ingress.yaml` | Phase 5 체크리스트에 외부 cert-manager 매니페스트 동기 반영 항목 추가 |
| 5 | Plan / Process | **plan 체크리스트 미갱신** — Phase 1~4 완료됐으나 모든 체크박스가 `[ ]` 상태; CLAUDE.md plan 라이프사이클 규약 위반 | `plan/in-progress/k8s-clemvion-rename.md` | 완료 항목 `[x]` 갱신 후 `git mv plan/in-progress/k8s-clemvion-rename.md plan/complete/` |
| 6 | Database / Docs | **`DB_DATABASE` 변경이 `k8s/README.md`에 미문서화** — plan 내부에만 리스크 메모 존재; 배포 담당자가 놓칠 수 있음 | `k8s/README.md` | "기존 클러스터 업그레이드 시 DB rename 사전 조치 필요" 주의 메모 추가 |
| 7 | Security / K8s | **`imagePullPolicy: IfNotPresent` + `:latest` 조합** — 보안 패치 신규 이미지가 노드 캐시에 의해 무시될 수 있음 (기존 문제) | `k8s/base/*-deployment.yaml`, `migrate-job.yaml` | staging/prod overlay에서 `imagePullPolicy: Always` 오버라이드 또는 git SHA 불변 태그 사용 |
| 8 | Security / K8s | **NetworkPolicy 부재** — namespace 내 모든 Pod 간 통신 무제한 허용 (기존 문제) | `k8s/base/` 전체 | `backend→postgres/redis`, `frontend→backend`만 허용하는 NetworkPolicy 추가 |
| 9 | Requirement / Docker | **docker-compose.yml volume 이름 정합성 미검증** — `docker-compose.yml`의 `name:` 필드가 `idea-workflow`로 남아있으면 README 명령이 동작하지 않음 | `README.md`, `docker-compose.yml` (미포함) | `docker-compose.yml`의 `name: clemvion` 여부 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | **namespace 전략 미명시** — staging/prod 같은 클러스터 시 `clemvion` namespace 충돌; "환경별 클러스터" 전제가 매니페스트에 명시 없음 | `k8s/overlays/*/kustomization.yaml` | overlay별 suffix(`clemvion-staging`, `clemvion-prod`) 분리 또는 README에 제약 명시 |
| 2 | Security / K8s | **frontend-deployment에 `fsGroup` 누락** — backend와 비대칭; 향후 볼륨 추가 시 권한 문제 가능 | `k8s/base/frontend-deployment.yaml` | `fsGroup: 1000` 및 `/tmp` emptyDir 마운트를 backend와 대칭으로 추가 |
| 3 | Monitoring | **OTEL 서비스명 변경으로 모니터링 히스토리 단절** | `k8s/base/configmap.yaml` | 모니터링 대시보드 서비스명 필터 사전 업데이트 |
| 4 | Documentation | **README.md 안내 문구 `clemvion-` 표기 모호** — 실제 디렉터리명과 불일치, 하이픈 혼동 | `README.md` 7번째 줄 | `clemvion-` → `clemvion` 또는 `frontend/`, `backend/` 경로 직접 명시 |
| 5 | Documentation | **`frontend/README.md` npm 외 패키지 매니저 잔존** — yarn/pnpm/bun 예시가 CLAUDE.md 규약에 위반 | `frontend/README.md` Getting Started | yarn/pnpm/bun 예시 제거, `npm run dev` 단독 표기 |
| 6 | Plan | **plan 문서 외부 경로 참조** — `~/.claude/plans/k8s-abstract-canyon.md`는 로컬 머신 전용, 팀원 재현 불가 | `plan/in-progress/k8s-clemvion-rename.md` 1행 | 인라인하거나 참조 줄 제거 |
| 7 | Testing / CI | **Phase 4 검증이 수동 grep에만 의존** — 검증 수행 여부 코드베이스 추적 불가 | `plan/in-progress/k8s-clemvion-rename.md` Phase 4 | CI에 잔존 키워드 grep 및 `kubectl kustomize` 렌더 스모크 테스트 추가 |
| 8 | Docker | **구 로컬 볼륨 `idea-workflow_backend_node_modules` 잔존** — 기존 개발자 환경 디스크 점유 | `README.md` | 업그레이드 노트에 구 볼륨 정리 one-liner 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | HIGH | Deployment selector immutable 충돌, TLS Secret 불일치, Ingress/namespace orphan |
| Database | MEDIUM | `DB_DATABASE` 기존 클러스터 연결 단절; OTEL 히스토리 단절 |
| Dependency | MEDIUM | `DB_DATABASE` 런타임 의존성 단절; CI 이미지 태그·cert-manager 외부 의존성 미동기화 |
| Performance | LOW | Deployment 재생성 다운타임; `:latest+IfNotPresent` 기존 비효율 |
| Security | LOW | 신규 취약점 없음; `imagePullPolicy+latest`·NetworkPolicy 부재(기존) |
| Architecture | LOW | `DB_DATABASE` 파괴 변경 혼재; namespace 전략 미명시 |
| Maintainability | LOW | plan 미갱신; DB 변경 주석 부재; 외부 plan 링크 |
| Documentation | LOW | plan 미완료; DB 변경 미문서화; README 문구 모호 |
| Requirement | LOW | plan 미갱신; docker-compose volume 정합성 미검증 |
| Testing | LOW | DB 변경 CI/E2E 영향 미검증; 수동 검증 의존 |
| Scope | LOW | 범위 완전 준수; plan 체크리스트 갱신만 후속 필요 |
| API Contract | NONE | API 계약 영향 없음 |
| Concurrency | NONE | 동시성 로직 변경 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Concurrency | 런타임 동시성 로직 변경 없음 |
| API Contract | API 엔드포인트·응답 형식·인증 로직 변경 없음 |

---

## 권장 조치사항

> 신규 클러스터 배포 시 1~3번 불필요. 기존 클러스터 in-place 적용 시 필수 이행.

**배포 전 필수 (기존 클러스터)**
1. **TLS Secret 복사** — 기존 `idea-workflow-*-tls` Secret을 `clemvion-*-tls`로 복사 또는 cert-manager CR `secretName` 선행 업데이트
2. **DB rename 또는 overlay 패치** — `ALTER DATABASE idea_workflow RENAME TO workflow` 선행, 또는 overlay에서 `DB_DATABASE: idea_workflow` 오버라이드 후 2단계 전환
3. **기존 Deployment 삭제** — `kubectl delete deployment backend frontend -n idea-workflow` 후 `kubectl apply -k` (ArgoCD: `Replace` sync option)

**배포 후 정리**

4. **구 Ingress 삭제** — `kubectl delete ingress idea-workflow-frontend idea-workflow-backend -n <구 namespace>`
5. **구 namespace 삭제** — 신규 배포 검증 후 `kubectl delete namespace idea-workflow`

**문서·프로세스 정리**

6. **plan 파일 완료 처리** — Phase 1~4 체크박스 `[x]` 갱신 → Phase 4 검증 실행 → `git mv plan/in-progress/k8s-clemvion-rename.md plan/complete/`
7. **`k8s/README.md` DB 변경 주의 메모 추가** — "기존 클러스터 업그레이드 시 DB rename 필요" 명시
8. **docker-compose.yml `name:` 필드 `clemvion` 여부 확인** 및 구 볼륨 정리 one-liner README 추가

**선택 개선 (기존 문제)**

9. **frontend-deployment `fsGroup: 1000` + `/tmp` emptyDir 추가** — backend와 대칭
10. **CI 리네임 일관성 검증 추가** — 잔존 키워드 grep + `kubectl kustomize` 렌더 스모크 테스트
11. **NetworkPolicy 추가** — Pod 간 통신 최소 권한 적용

---

**핵심 요약**: 리네임 자체는 완전하고 일관되게 적용됐지만, **기존 클러스터 배포 시 Critical 3건**(DB 연결 단절·Deployment immutable 충돌·TLS Secret 불일치)이 동시에 발생할 수 있어 배포 전 순서 관리가 필수입니다.