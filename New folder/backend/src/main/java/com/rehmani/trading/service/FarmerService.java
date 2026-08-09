package com.rehmani.trading.service;

import com.rehmani.trading.dto.FarmerRequest;
import com.rehmani.trading.dto.FarmerResponse;
import com.rehmani.trading.entity.Farmer;
import com.rehmani.trading.repository.FarmerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FarmerService {

    private final FarmerRepository farmerRepository;

    public List<FarmerResponse> getAll() {
        return farmerRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public FarmerResponse getById(Long id) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        return toResponse(farmer);
    }

    @Transactional
    public FarmerResponse create(FarmerRequest request) {
        Farmer farmer = Farmer.builder()
                .farmerId(generateFarmerId())
                .name(request.getName())
                .cnic(request.getCnic())
                .phone(request.getPhone())
                .address(request.getAddress())
                .city(request.getCity())
                .notes(request.getNotes())
                .build();
        return toResponse(farmerRepository.save(farmer));
    }

    @Transactional
    public FarmerResponse update(Long id, FarmerRequest request) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        farmer.setName(request.getName());
        farmer.setCnic(request.getCnic());
        farmer.setPhone(request.getPhone());
        farmer.setAddress(request.getAddress());
        farmer.setCity(request.getCity());
        farmer.setNotes(request.getNotes());
        return toResponse(farmerRepository.save(farmer));
    }

    @Transactional
    public void delete(Long id) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        farmer.setDeleted(true);
        farmerRepository.save(farmer);
    }

    private String generateFarmerId() {
        Integer max = farmerRepository.findMaxFarmerNumber();
        int next = (max != null ? max : 0) + 1;
        return String.format("FRM%05d", next);
    }

    private FarmerResponse toResponse(Farmer farmer) {
        return FarmerResponse.builder()
                .id(farmer.getId())
                .farmerId(farmer.getFarmerId())
                .name(farmer.getName())
                .cnic(farmer.getCnic())
                .phone(farmer.getPhone())
                .address(farmer.getAddress())
                .city(farmer.getCity())
                .outstandingBalance(farmer.getOutstandingBalance())
                .notes(farmer.getNotes())
                .active(farmer.getActive())
                .build();
    }
}
